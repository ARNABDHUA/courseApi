const express=require("express")
const app=express()
const product=require("./models/product")
const mongoose=require("mongoose")
const bcrypt = require("bcrypt");
require("dotenv").config()
const bodyparser = require('body-parser')
const port=process.env.PORT || 5000

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
    try
   { console.log(req.body)
    
    await connectDb(process.env.MONGODB_URL)
    let show=await product.insertMany(req.body)
    res.send(show)}
    catch(err){
        console.log(err)
    }
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
    }
    catch(error){
        console.log(error);
    }
}

start();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB:", err));

// Teacher schema and model
const teacherSchema = new mongoose.Schema({
  name: String,
  joiningDate: String,
  password: String,
  birthDate: String,
  streams: [String],
  subjects: [String],
  registerNumber: String,
  // mcaTeacher: { type: Boolean, default: false }, // Changed to Boolean
});

const Teacher = mongoose.model("Teacher", teacherSchema);

const adminSchema = new mongoose.Schema({
  adminId: String,
  password: String,
});

const Admin = mongoose.model("Admin", adminSchema);

// // Prepopulate with 5 admins (run this only once)
const createAdmins = async () => {
  const admins = [
    { adminId: "admin01", password: await bcrypt.hash("password01", 10) },
    { adminId: "admin02", password: await bcrypt.hash("password02", 10) },
    { adminId: "admin03", password: await bcrypt.hash("password03", 10) },
    { adminId: "admin04", password: await bcrypt.hash("password04", 10) },
    { adminId: "admin05", password: await bcrypt.hash("password05", 10) },
  ];

  await Admin.insertMany(admins);
  console.log("Admin accounts created");
};
// Uncomment this line to create the admins (run this once and then comment it back)
// createAdmins();


// Helper function to generate register number
const generateRegisterNumber = async (joiningYear, streamCodes) => {
  const sumStreamCodes = streamCodes.reduce((sum, code) => sum + parseInt(code), 0);
  const sumStr = sumStreamCodes.toString().padStart(2, "0").slice(-2); // Take the last two digits of the sum

  const count = (await Teacher.countDocuments({})) + 1;
  const countStr = count.toString().padStart(4, "0");
  return `${joiningYear}${sumStr}${countStr}`;
};

// Ensure you have this endpoint in your Express server
app.get('/api/teachers', async (req, res) => {
  try {
    const teachers = await Teacher.find(req.query);
    res.status(200).json({ teachers });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({ message: "Error fetching teachers data" });
  }
});


// Endpoint to register a teacher
app.post("/api/register-teacher", async (req, res) => {
  const { name, joiningDate, password, birthDate, streams, subjects } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const joiningYear = joiningDate.slice(0, 4);

    const streamCodeMap = {
      BTech: "06",
      MCA: "07",
      MBA: "05",
      BArch: "08",
      BA: "09",
      MTech: "10",
    };

    // Map selected streams to their respective codes
    const selectedStreamCodes = streams.map(stream => streamCodeMap[stream] || "00");

    const registerNumber = await generateRegisterNumber(joiningYear, selectedStreamCodes);

    const newTeacher = new Teacher({
      name,
      joiningDate,
      password: hashedPassword, // Store the hashed password
      birthDate,
      streams,
      subjects,
      registerNumber,
    });

    await newTeacher.save();
    res
      .status(201)
      .json({ message: "Teacher registered successfully", registerNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering teacher" });
  }
});

// Endpoint to sign in a teacher
app.post('/api/signin-teacher', async (req, res) => {
  const { registerNumber, password } = req.body;

  try {
    const teacher = await Teacher.findOne({ registerNumber });
    if (!teacher) {
      return res.status(400).json({ success: false, message: 'Invalid registration number or password.' });
    }

    // Compare provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid registration number or password.' });
    }

    res.status(200).json({ success: true, message: 'Sign-in successful!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

// Endpoint to fetch teacher data by registration number
app.get("/api/teacher/:registerNumber", async (req, res) => {
  const { registerNumber } = req.params;

  try {
    const teacher = await Teacher.findOne({ registerNumber });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    res.status(200).json(teacher);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching teacher data" });
  }
});


// Endpoint to give authentication to the admin
app.post("/api/admin-auth", async (req, res) => {
  const { adminId, adminPassword } = req.body;

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(400).json({ success: false, message: "Invalid admin ID or password" });
    }

    const isMatch = await bcrypt.compare(adminPassword, admin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid admin ID or password" });
    }

    const teachers = await Teacher.find({});
    res.status(200).json({ success: true, teachers });
  } catch (error) {
    console.error("Error authenticating admin:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Endpoint to edit a teacher
app.put("/api/teacher/:registerNumber", async (req, res) => {
  const { registerNumber } = req.params;
  const updatedData = req.body;

  try {
    const teacher = await Teacher.findOneAndUpdate({ registerNumber }, updatedData, { new: true });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    res.status(200).json({ message: "Teacher updated successfully", teacher });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating teacher" });
  }
});

// Endpoint to delete a teacher
app.delete("/api/teacher/:registerNumber", async (req, res) => {
  const { registerNumber } = req.params;

  try {
    const teacher = await Teacher.findOneAndDelete({ registerNumber });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }
    res.status(200).json({ message: "Teacher deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting teacher" });
  }
});

// Student schema and model
const studentSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  phonenumber: Number,
  guardian:String,
  status:{ type: Boolean, default: true },
  bca: { type: Boolean, default: false },
  mca: { type: Boolean, default: false },
  btech: { type: Boolean, default: false }, 
  mtech: { type: Boolean, default: false },
  bba: { type: Boolean, default: false },
  mba: { type: Boolean, default: false },
  jeemain:{ type: Boolean, default: false },
  wbjeca:{ type: Boolean, default: false },
  wbjee:{ type: Boolean, default: false }, 
  gate:{ type: Boolean, default: false },
  ipmat:{ type: Boolean, default: false },
  cat:{ type: Boolean, default: false },// Changed to Boolean
});

const Student = mongoose.model("Student", studentSchema);

// Ensure you have this endpoint in your Express server
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find(req.query);
    res.status(200).json({ students });
  } catch (error) {
    console.error("Error fetching teachers:", error);
    res.status(500).json({ message: "Error fetching teachers data" });
  }
});

app.post("/api/register-student", async (req, res) => {
  const { name, email, password, phonenumber,guardian } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newStudent = new Student({
      name,
      email,
      password: hashedPassword, // Store the hashed password
      phonenumber,
      guardian
    });

    await newStudent.save();
    res
      .status(201)
      .json({ message: "registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error registering" });
  }
});

// Endpoint to sign in a student
app.post('/api/signin-student', async (req, res) => {
  const { email, password } = req.body;

  try {
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(400).json({ success: false, message: 'Invalid registration number or password.' });
    }

    // Compare provided password with the stored hashed password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid registration number or password.' });
    }

    res.status(200).json({ success: true, message: 'Sign-in successful!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

// Endpoint to edit a student
app.put("/api/student/:email", async (req, res) => {
  const { email } = req.params;
  const updatedData = req.body;

  try {
    const student = await Student.findOneAndUpdate({ email }, updatedData,{ new: true });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.status(200).json({ message: "Student updated successfully", student });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating student" });
  }
});

// Endpoint to delete a student
app.delete("/api/student/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const student = await Student.findOneAndDelete({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting Student" });
  }
});


// Student schema and model
const courseExamSchema = new mongoose.Schema({
  sub :String,
  teacher:String,
  paper:String,
  des:String,
  question: String,
  option1:String,
  option2:String,
  option3:String,
  option4:String,
  ans:Number,
  examnumber:String,
  status:{ type: Boolean, default: false },
 // Changed to Boolean
});

const CourseExam = mongoose.model("Courseexam", courseExamSchema);

// Ensure you have this endpoint in your Express server
app.get('/api/courseexam', async (req, res) => {
  try {
    const Courseexam = await CourseExam.find(req.query);
    res.status(200).json({ Courseexam });
  } catch (error) {
    console.error("Error fetching courseexam check the data", error);
    res.status(500).json({ message: "Error fetching courseexam data" });
  }
});

app.post("/api/courseexam-student", async (req, res) => {
  const { sub,teacher, paper,des, question, option1,option2,option3,option4,ans,examnumber } = req.body;

  try {

    const newCourseExam = new CourseExam({
      sub,
      teacher,
      paper,
      des,
      question,
      option1,
      option2,
      option3,
      option4,
      ans,
      examnumber
      
    });

    await newCourseExam.save();
    res
      .status(201)
      .json({ message: "Add the course Exam Question" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error course Exam" });
  }
});

// Endpoint to edit a courseexam
app.put("/api/courseexam/:id", async (req, res) => {
  // const { _id } = req.params;
  const updatedData = req.body;

  try {
    const couseexam = await CourseExam.findOneAndUpdate({_id: new mongoose.mongo.ObjectId(req.params.id)}, updatedData,{ new: true });
    if (!couseexam) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.status(200).json({ message: "updated successfully", couseexam });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating exam" });
  }
});

app.delete("/api/courseexam/:id",async(req,res)=>{
  try
  {await connectDb(process.env.MONGODB_URL)
  let show=await CourseExam.deleteOne({_id: new mongoose.mongo.ObjectId(req.params.id)})
  res.send(show)}
 catch(error){
  console.log(error)
 }
})

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});