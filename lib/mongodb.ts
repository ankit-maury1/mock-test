import mongoose from 'mongoose'
import { serverEnv } from './env'

declare global {
  // eslint-disable-next-line no-var
  var _axisMongoConn: Promise<typeof mongoose> | undefined
}

/**
 * Returns a cached Mongoose connection promise.
 * Safe to call from many parallel API routes — hot-reload in dev reuses the same connection.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (global._axisMongoConn) return global._axisMongoConn
  const uri = serverEnv.MONGODB_URI
  global._axisMongoConn = mongoose.connect(uri, {
    bufferCommands: false,
    maxPoolSize: 10,
  })
  return global._axisMongoConn
}
