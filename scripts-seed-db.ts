import fs from 'fs'
import path from 'path'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

function getMongoUri(): string {
  // Check .env.local first, then .env
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(process.cwd(), envFile)
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.startsWith('MONGODB_URI=')) {
          let val = trimmed.replace('MONGODB_URI=', '').trim()
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
          }
          if (val) return val
        }
      }
    }
  }
  return process.env.MONGODB_URI ?? ''
}

const uri = getMongoUri()

if (!uri) {
  console.error('Error: MONGODB_URI is not set in .env.local or .env!')
  process.exit(1)
}

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'student'], default: 'student' },
    roomIds: { type: [String], default: [] },
    instituteId: { type: String },
  },
  { timestamps: true }
)

const RoomSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    adminId: { type: String, required: true },
    memberIds: { type: [String], default: [] },
    instituteId: { type: String },
  },
  { timestamps: true }
)

const UserModel = mongoose.models.User || mongoose.model('User', UserSchema)
const RoomModel = mongoose.models.Room || mongoose.model('Room', RoomSchema)

async function run() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(uri)
    console.log('Connected successfully to MongoDB!')

    // 1. Delete all admin users
    const deleteAdminsResult = await UserModel.deleteMany({ role: 'admin' })
    console.log(`[DELETED] Removed ${deleteAdminsResult.deletedCount} admin user(s).`)

    // 2. Remove old demo owner if exists
    await UserModel.deleteMany({ email: 'owner@prayas.test' })

    // 3. Upsert owner@gmail.com
    const ownerEmail = 'owner@gmail.com'
    const ownerPassword = 'owner123'
    const ownerHash = await bcrypt.hash(ownerPassword, 10)

    let owner = await UserModel.findOne({ email: ownerEmail })
    if (owner) {
      owner.role = 'owner'
      owner.name = 'Owner'
      owner.passwordHash = ownerHash
      await owner.save()
      console.log(`[UPDATED] Owner account (${ownerEmail}) updated with password '${ownerPassword}'.`)
    } else {
      owner = await UserModel.create({
        id: 'usr_owner',
        name: 'Owner',
        email: ownerEmail,
        passwordHash: ownerHash,
        role: 'owner',
        roomIds: [],
      })
      console.log(`[CREATED] Seeded new Owner account (${ownerEmail}) with password '${ownerPassword}'.`)
    }

    // 4. Update any rooms to be owned by usr_owner
    const updateRoomsResult = await RoomModel.updateMany(
      {},
      { $set: { adminId: owner.id } }
    )
    console.log(`[ROOMS] Reassigned ${updateRoomsResult.modifiedCount} room(s) to owner (${owner.id}).`)

    // 5. List all users currently in database
    const allUsers = await UserModel.find({}, { id: 1, name: 1, email: 1, role: 1 }).lean()
    console.log('\n--- Current Users in Database ---')
    console.table(allUsers)

  } catch (err) {
    console.error('Seed script error:', err)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
    process.exit(0)
  }
}

run()
