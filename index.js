const express = require('express');
const cors = require("cors");
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
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

const uri = `mongodb+srv://household-user:O1rjWwEbPxDPyv6M@cluster0.otz5f.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
    try {
        await client.connect();
        const productCollection = client.db("household").collection("products");
        const userCollection = client.db("household").collection("users");

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


        app.get('/admin/:email', async(req, res)=>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const admin  = user.role === 'admin';
            res.send({admin: admin});
        })
        app.put('/users/admin/:email',verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requesterClient = req.decoded.email;
            const clientAccount = await userCollection.findOne({email: requesterClient});

            if(clientAccount.role === 'admin'){
                const filter = { email: email };
            const updateDoc = {
                $set: {role: 'admin'}
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
            }else{
                res.status(403).send({message: 'forbidden'})
            }
            
        })

        app.get('/users', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
    } finally {
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