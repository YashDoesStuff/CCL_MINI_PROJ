require("dotenv").config({ path: "./.env" });
const mongoose = require("mongoose");
const User = require("./models/User");
const Faculty = require("./models/Faculty");

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://yashmasaye007:511473@cluster0.cnjeb5y.mongodb.net/smart-timetable";

async function sync() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB...");

    const facultyUsers = await User.find({ role: "faculty" });
    let count = 0;

    for (const user of facultyUsers) {
      const exists = await Faculty.findById(user._id);
      if (!exists) {
        await Faculty.create({
          _id: user._id,
          name: user.name,
        });
        count++;
        console.log(`Synced Faculty: ${user.name}`);
      }
    }

    console.log(`Successfully synced ${count} missing faculties.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

sync();
