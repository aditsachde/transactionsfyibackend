import { db, customFunctions } from '../utils/utils'

exports.webhook = customFunctions.https.onRequest(async (req, res) => {
    await db.collection('stripehook').add(req.body)
    res.status(200)
  })