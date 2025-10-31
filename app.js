const express=require("express")
const app=express()
const product=require("./models/product")
const mongoose=require("mongoose")
const bcrypt = require("bcrypt");
require("dotenv").config()
const bodyparser = require('body-parser')
const winston = require("winston");
const useragent = require("express-useragent");
const port=process.env.PORT || 5000

app.use(useragent.express()); // middleware to detect device/browser info
const DailyRotateFile = require("winston-daily-rotate-file");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // show logs in terminal
    new winston.transports.File({ filename: "combined.log" }), // save all logs
    new winston.transports.File({ filename: "error.log", level: "error" }), // only errors
  ],
});
logger.add(
  new DailyRotateFile({
    filename: "logs/app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
  })
);

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

app.post("/api/reset-password", async (req, res) => {
  const { registerNumber, oldPassword, newPassword } = req.body;

  try {
    // Validate request fields
    if (!registerNumber || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // Find teacher by registerNumber
    const teacher = await Teacher.findOne({ registerNumber });
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found." });
    }

    // Compare old password
    const isMatch = await bcrypt.compare(oldPassword, teacher.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Old password is incorrect." });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in the database
    teacher.password = hashedPassword;
    await teacher.save();

    return res.status(200).json({ success: true, message: "Password reset successful." });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res.status(500).json({ success: false, message: "Internal server error." });
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

   const ua = req.useragent;

  // Detect Device and Browser
  let deviceType = ua.isMobile ? "Mobile" : "Desktop";
  let os = ua.os || "Unknown OS";
  let browser = ua.browser || "Unknown Browser";
  const deviceInfo = `${deviceType} (${os} - ${browser})`;

  // Log the request safely
  logger.info(
    `Login attempt: name=${adminId}, device=${deviceInfo}`
  );

  try {
    const admin = await Admin.findOne({ adminId });
    if (!admin) {
      return res.status(400).json({ success: false, message: "Invalid admin ID or password" });
    }

    const isMatch = await bcrypt.compare(adminPassword, admin.password);
    if (!isMatch) {
      logger.error(`❌ Login failed  from ${deviceInfo} because Invalid admin ID or password`);
      return res.status(400).json({ success: false, message: "Invalid admin ID or password" });
    }

    const teachers = await Teacher.find({});
    res.status(200).json({ success: true, teachers });
  } catch (error) {
    console.error("Error authenticating admin:", error);
    logger.error(`❌ Login failed  from ${deviceInfo}`);
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
  course:String,
  starting:String,
  end:String,
  roll:String,
  eroll:String,
  ecourse:String,
  status:{ type: Boolean, default: true },
  bca: { type: Boolean, default: false },
  mca: { type: Boolean, default: false },
  btech: { type: Boolean, default: false }, 
  mtech: { type: Boolean, default: false },
  bba: { type: Boolean, default: false },
  mba: { type: Boolean, default: false },
  jeemain:{ type: Boolean, default: false },
  jeca:{ type: Boolean, default: false },
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
// app.put("/api/student/:email", async (req, res) => {
//   const { email } = req.params;
//   const updatedData = req.body;

//   try {
//     const student = await Student.findOneAndUpdate({ email }, updatedData,{ new: true });
//     if (!student) {
//       return res.status(404).json({ message: "Student not found" });
//     }
//     res.status(200).json({ message: "Student updated successfully", student });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Error updating student" });
//   }
// });

const generateERollNumber = async (joiningYear, streamCodes) => {
  const sumStreamCodes = streamCodes.reduce((sum, code) => sum + parseInt(code, 10), 0);
  const sumStr = sumStreamCodes.toString().padStart(2, "0").slice(-2); // Take the last two digits of the sum

  const erollPrefix = `${joiningYear}${sumStr}` //change
  const count = (await Student.countDocuments({ eroll: { $regex: `^${erollPrefix}` } })) + 1;//change
  const countStr = count.toString().padStart(4, "0");
  return `${joiningYear}${sumStr}${countStr}`;
};


app.put("/api/studentseroll/:email", async (req, res) => {
  const { email } = req.params;
  const updatedData = { ...req.body }; // Copy req.body to updatedData

  try {
    // Check if the student exists
    let student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if ecourse needs to be added
    if (!student.ecourse && updatedData.ecourse) {
      // Add `ecourse` to updatedData if it's provided and doesn't exist in the student's record
      student.ecourse = updatedData.ecourse;
    }

    // Generate and add roll number if `ecourse` exists and `eroll` is missing
    if (student.ecourse && !student.eroll) {
      const streamCodeMap = {
       WBJEE:"22",
        JECA :"21",
        JEEMAIN:"31",
        GATE:"50",
        IPMAT:"55",
        CAT:"66",
      };

      // Map selected streams to their respective codes
      const selectedStreamCodes = [(streamCodeMap[student.ecourse] || "00")];

      updatedData.eroll = await generateERollNumber("Ex1121", selectedStreamCodes);
    }

    // Update the student's information with the new roll and course, if applicable
    student = await Student.findOneAndUpdate({ email }, updatedData, { new: true });
    res.status(200).json({ message: "Student updated successfully", student });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating student" });
  }
});

const generateRollNumber = async (joiningYear, streamCodes) => {
  const sumStreamCodes = streamCodes.reduce((sum, code) => sum + parseInt(code, 10), 0);
  const sumStr = sumStreamCodes.toString().padStart(2, "0").slice(-2); // Take the last two digits of the sum

  const rollPrefix = `${joiningYear}${sumStr}` //change
  const count = (await Student.countDocuments({ roll: { $regex: `^${rollPrefix}` } })) + 1;//change
  const countStr = count.toString().padStart(4, "0");
  return `${joiningYear}${sumStr}${countStr}`;
};

app.put("/api/student/:email", async (req, res) => {
  const { email } = req.params;
  const updatedData = { ...req.body }; // Copy req.body to updatedData

  try {
    // Check if the student exists
    let student = await Student.findOne({ email });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check if course needs to be added
    if (!student.course && updatedData.course) {
      // Add `course` to updatedData if it's provided and doesn't exist in the student's record
      student.course = updatedData.course;
    }

    // Generate and add roll number if `course` exists and `roll` is missing
    if (student.course && !student.roll) {
      const streamCodeMap = {
        BCA: "22",
        MCA: "12",
        MBA: "13",
        BTech: "15",
        BBA: "14",
        MTech: "24",
        JECA :"21"
      };

      // Map selected streams to their respective codes
      const selectedStreamCodes = [(streamCodeMap[student.course] || "00")];

      updatedData.roll = await generateRollNumber("3024", selectedStreamCodes);
    }

    // Update the student's information with the new roll and course, if applicable
    student = await Student.findOneAndUpdate({ email }, updatedData, { new: true });
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

const attendance = new mongoose.Schema({
  sub :String,
  teacher:String,
  paper:String,
  date:String,
  student:String,
  roll:String,
  lock:{ type: Boolean, default: false },
 // Changed to Boolean
});

const Atten = mongoose.model("Attendance", attendance);

// Ensure you have this endpoint in your Express server
app.get('/api/atten', async (req, res) => {
  try {
    const attend = await Atten.find(req.query);
    res.status(200).json({ attend });
  } catch (error) {
    console.error("Error fetching attendence check the data", error);
    res.status(500).json({ message: "Error fetching attendance data" });
  }
});

app.post("/api/atten", async (req, res) => {
  const { sub,teacher, paper,date,student,lock,roll } = req.body;

  try {

    const newAtten = new Atten({
      sub,
      teacher,
      paper,
      date,
      student,
      lock,
      roll
      
    });

    await newAtten.save();
    res
      .status(201)
      .json({ message: "Add the attendence" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in attendence" });
  }
});

app.delete("/api/atten/:id",async(req,res)=>{
  try
  {await connectDb(process.env.MONGODB_URL)
  let show=await Atten.deleteOne({_id: new mongoose.mongo.ObjectId(req.params.id)})
  res.send(show)}
 catch(error){
  console.log(error)
 }
});

//result

const result = new mongoose.Schema({
  student :String,
  teacher:String,
  paper:String,
  sub:String,
  examno: String,
  roll:String,
  score:Number,
  email:String,
  status:{ type: Boolean, default: false },
 // Changed to Boolean
});
const Result = mongoose.model("Result", result);

// Ensure you have this endpoint in your Express server
app.get('/api/result', async (req, res) => {
  try {
    const result = await Result.find(req.query);
    res.status(200).json({ result });
  } catch (error) {
    console.error("Error fetching attendence check the data", error);
    res.status(500).json({ message: "Error fetching attendance data" });
  }
});

app.post("/api/result", async (req, res) => {
  const { student,teacher, paper,sub,examno,roll,score,email } = req.body;

  try {

    const newResult = new Result({
      student,
      teacher,
      paper,
      sub,
      examno,
      roll,
      score,
      email
      
    });

    await newResult.save();
    res
      .status(201)
      .json({ message: "Add the attendence" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in attendence" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});