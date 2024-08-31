const express=require("express")
const router=express.Router();

const{
    getAllProductsTesting,
    getAllproduct,
}=require("../controllers/products")

router.route("/").get(getAllproduct);
router.route("/testing").get(getAllProductsTesting)

module.exports=router;