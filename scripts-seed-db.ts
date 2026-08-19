import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

function getMongoUri() {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('MONGODB_URI=')) {
        let val = trimmed.replace('MONGODB_URI=', '').trim()
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        return val
      }
    }
  }
  return process.env.MONGODB_URI ?? ''
}

const uri = getMongoUri()

if (!uri) {
  console.error('Error: MONGODB_URI is not set in .env!')
  process.exit(1)
}

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'student' },
  roomIds: { type: [String], default: [] },
}, { timestamps: true })

const UserModel = mongoose.models.User || mongoose.model('User', UserSchema)

async function run() {
  try {
    console.log('Connecting to MongoDB at:', uri)
    await mongoose.connect(uri)
    console.log('Connected successfully!')

    const email = 'ankit.maury168@gmail.com'
    const password = 'Ankit123'
    const hash = await bcrypt.hash(password, 10)

    const existing = await UserModel.findOne({ email })
    if (existing) {
      existing.passwordHash = hash
      existing.role = 'admin'
      await existing.save()
      console.log(`[SUCCESS] Updated existing user (${email}) to admin with password '${password}'!`)
    } else {
      await UserModel.create({
        id: crypto.randomUUID(),
        name: 'Ankit Maurya',
        email,
        passwordHash: hash,
        role: 'admin',
        roomIds: [],
      })
      console.log(`[SUCCESS] Created admin user (${email}) with password '${password}'!`)
    }
  } catch (err) {
    console.error('Seed error:', err)
  } finally {
    await mongoose.disconnect()
    process.exit(0)
  }
}

run()
