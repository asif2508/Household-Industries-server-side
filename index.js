const express = require('express');
const cors = require("cors");
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express()
const port = process.env.PORT || 5000;

// using middlewire
app.use(cors());
app.use(express.json());

// CONNECTING TO DATABASE

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.WEB_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.otz5f.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const productCollection = client.db("household").collection("products");
        const userCollection = client.db("household").collection("users");
        const ordersCollection = client.db("household").collection("orders");
        const reviewCollection = client.db("household").collection("reviews");


        // user, email, admin, jwt api's
        app.put('/users/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.WEB_TOKEN_SECRET, { expiresIn: '1d' });

            res.send({ result, token });
        });


        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const admin = user.role === 'admin';
            res.send({ admin: admin });
        })
        app.put('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requesterClient = req.decoded.email;
            const clientAccount = await userCollection.findOne({ email: requesterClient });

            if (clientAccount.role === 'admin') {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' }
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            } else {
                res.status(403).send({ message: 'forbidden' })
            }

        })

        app.get('/users', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.delete('/users/:_id', async (req, res) => {
            const id = req.params._id;
            const query = { _id: ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })


        // product api's
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/products', async(req, res)=>{
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        app.get('/products/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result);
        });
        app.delete('/products/:_id', async (req, res) => {
            const id = req.params._id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })
        app.get('/manage/:_id', async (req, res) => {
            const id = req.params._id;
            const query = { _id: ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result);
        });

        app.put('/products/:_id', async (req, res)=>{
            const id = req.params._id;
            const change = req.body;
           if(change){
            filter ={_id : ObjectId(id)}
            const options = { upsert: true };
            const updateDoc = {
                $set: change,
            };
            const result = await productCollection.updateOne(filter, updateDoc, options);
            res.send(result);
           }
        })


        //orders api
        app.get('/orders', async(req, res)=>{
            const query={};
            const cursor = ordersCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.post('/orders', async(req, res)=>{
            const order = req.body;
            const result = await ordersCollection.insertOne(order);
            res.send(result);
        })
        app.put('/orders/:_id', async (req, res)=>{
            const id = req.params._id;
            console.log(id);
            const order = req.body;
            console.log(order);
           if(order){
            filter ={_id : ObjectId(id)}
            const options = { upsert: true };
            const updateDoc = {
                $set: order,
            };
            const result = await ordersCollection.updateOne(filter, updateDoc, options);
            res.send(result);
           }
        })
        app.get('/myorders/:email', async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};
            const cursor = ordersCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.delete('/orders/:_id', async (req, res) => {
            const id = req.params._id;
            const query = { _id: ObjectId(id) }
            const result = await ordersCollection.deleteOne(query);
            res.send(result);
        })

        // Payment intent api
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            console.log(service);
            const price = service.price;
           if(price > 0){
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
           }
        });

        // review api
        app.get('/reviews', async(req, res)=>{
            const query={};
            const cursor = reviewCollection.find(query);
            const result  = await cursor.toArray();
            res.send(result);
        })

        app.post('/reviews', async(req, res)=>{
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })
    
    } 
    finally {
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})