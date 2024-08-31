const connectDb=require("./db/connect")
const product=require("./models/product")
require("dotenv").config()
const produtJson=require("./products.json")
const start=async()=>{
    try{
        await connectDb(process.env.MONGODB_URL)
        await product.create([{
            "name": "Bodmas",
              "link": "https://tailwindcss.com/docs/box-shadow",
              "subtitle": "mcapython1",
              "sub": "mcaLIVE",
              "time": "10:00"
        }])
        console.log("ok run")
    }
    catch(error){
        console.log(error)
    }
}

start()