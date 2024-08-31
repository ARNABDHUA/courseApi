const product=require("../models/product")

const getAllproduct=async(req,res)=>{
    const mydata=await product.find(req.query)
    res.status(200).json({mydata})
}
const getAllProductsTesting=async(req,res)=>{
    res.status(200).json(req.body)
}
module.exports={getAllProductsTesting,getAllproduct}