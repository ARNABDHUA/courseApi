const mongoose=require("mongoose")

const productSchema=new mongoose.Schema({
    "name": {
        type: String,
        required: true
    },
      "link": {
        type: String,
        required: true
      },
      "subtitle": {
        type: String,
        required: true
      },
      "sub": {
        type: String,
        required: true
      },
      "time": {
        type: String,
        required: true
      },
      "date":{
        type: Date,
        default:Date.now()
      },
      "teacher":{
        type: String,
        required: true
      }
      
})

module.exports=mongoose.model("Product",productSchema)