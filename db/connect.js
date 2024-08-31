const mongoose= require("mongoose")

const connectDb=(uri)=>{
    console.log("hello")
    return mongoose.connect(uri)
}

module.exports=connectDb