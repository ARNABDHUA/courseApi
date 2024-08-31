const express=require("express")
const app=express()
const product=require("./models/product")
const mongoose=require("mongoose")
require("dotenv").config()
const bodyparser = require('body-parser')
const PORT=process.env.PORT || 4000

const products_routs=require("./routes/products")

const connectDb=require("./db/connect")
const cors = require('cors')

app.use(cors()) // Use this after the variable declaration
app.use(bodyparser.json())
// app.use(express.json)
app.get("/",(req,res)=>{
    res.send("Hello World");
})

app.post("/api/products",async(req,res)=>{
    console.log(req.body)
    
    await connectDb(process.env.MONGODB_URL)
    let show=await product.insertMany(req.body)

    res.send(show)
})

app.delete("/api/products/:id",async(req,res)=>{
    try
    {await connectDb(process.env.MONGODB_URL)
    let show=await product.deleteOne({_id: new mongoose.mongo.ObjectId(req.params.id)})
    res.send(show)}
   catch(error){
    console.log(error)
   }
})

// middleware
app.use("/api/products",products_routs)

const start= async()=>{
    try{
        await connectDb(process.env.MONGODB_URL)
         app.listen(PORT,()=>{
            console.log(`Server is running on port ${PORT}`);
         })
    }
    catch(error){
        console.log(error);
    }
}

start();