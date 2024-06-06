const { spawn } = require('node:child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const connectToDatabase = require('../db/conn.js');
const { ensureRole } = require('./auth');
const { role } = require('../utils/userRoles');

require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const ytdlpPython = process.env.PYTHON_GATHER;

let router = express.Router();

function dateToISOStringPy(date) {
  return date.toISOString().replace('Z', '+00:00');
}

function urlInfoPromise(url) {
  return new Promise((resolve, reject) => {
    const python = spawn(
      ytdlpPython,
      [
        '-m',
        'yt_dlp',
        url,
        '--no-download',
        '--playlist-items',
        '1',
        '--no-playlist',
        '-O',
        '%(extractor_key)s/%(uploader)s/%(uploader_id)s'
      ]
    );

    let info = null;

    python.stdout.on('data', data => {
      console.debug(`stdout:\n${data}`);
      try {
        const [extractor_key, uploader, uploader_id] = data.toString().trim().split('/');
        info = { extractor_key, uploader, uploader_id: uploader_id.replace("@", "") };
      } catch (error) {
        console.error(`Error parsing yt-dlp data for ${url}`);
      }
    });

    python.stderr.on('data', data => {
      console.error(`stderr: ${data}`);
    });

    python.on('error', (error) => {
      console.error(`error: ${error.message}`);
    });

    python.on('close', (code) => {
      console.debug(`python process exited with code ${code}`);
      if (code == 0 && info) {
        resolve(info);
      } else {
        reject();
      }
    });
  });
}

router.post('/watchlist', ensureRole(role.editor), async (req, res) => {
  const userId = req.user._id.toString();
  const { link } = req.body;
  let result = null;
  try {
    const info = await urlInfoPromise(link);
    const platform = info.extractor_key.toLowerCase();
    if (!['youtube', 'tiktok'].includes(platform)) {
      throw new Error('Invalid platform');
    }
    const channelInfo = {
      platform: platform,
      channelId: info.uploader_id,
      channelName: info.uploader,
    };
    const db = await connectToDatabase();
    await db.collection('watchlist').updateOne(
      {
        platform: channelInfo.platform,
        channelId: channelInfo.channelId,
      },
      { $set: channelInfo },
      { upsert: true }
    );
    await db.collection('watchlist').updateOne(
      {
        platform: channelInfo.platform,
        channelId: channelInfo.channelId,
        'monitoringUsers.userId': { $ne: userId }
      },
      {
        $push: {
          monitoringUsers: {
            userId, subscribeDatetime: dateToISOStringPy(new Date())
          }
        }
      },
    );
    result = { ok: true };
    console.debug(`Channel added for ${userId}: ${link}`)
  } catch (error) {
    console.error(`Error adding channel ${error}`)
    result = { error: 'Error adding channel' };
  }
  res.json(result)
});

router.get('/watchlist', ensureRole(role.editor), async (req, res) => {
  const userId = req.user._id.toString();
  const db = await connectToDatabase();
  const results = await db.collection('watchlist').aggregate([
    { $match: { 'monitoringUsers.userId': userId } },
    {
      $addFields: {
        monitoringUsers: {
          $filter: {
            input: "$monitoringUsers",
            as: "item",
            cond: { $eq: ["$$item.userId", userId] }
          }
        }
      }
    },
    { $sort: { _id: -1 } }
  ]).toArray();
  res.json(results)
});

router.delete('/watchlist/:id', ensureRole(role.editor), async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;
  const db = await connectToDatabase();
  // Remove user from monitoring
  const result = await db.collection('watchlist').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $pull: { 'monitoringUsers': { userId } } },
    { returnDocument: 'after' }
  );
  // If there are no more users monitoring it remove the channel
  if (result?.value?.monitoringUsers?.length === 0) {
    console.debug(`Deleting channel ${id}. No monitoring users.`)
    await db.collection('watchlist').deleteOne({ _id: new ObjectId(id) });
  }
  res.json({ ok: true });
});

router.post('/request', ensureRole(role.uploader), multer().none(), async (req, res) => {
  const userId = req.user._id.toString();
  const { link, transcription, fake } = req.body;
  const transcribeEnabled = Boolean(transcription);
  const fakeEnabled = Boolean(fake);
  const request = {
    source: 'manualRequest',
    userId: userId,
    url: link,
    requestDatetime: dateToISOStringPy(new Date()),
    priority: 1,
    status: 'requested',
    videoId: null,
    analysisEnabled: { transcribe: transcribeEnabled, fake: fakeEnabled },
  };
  const db = await connectToDatabase();
  const result = await db.collection('requests').insertOne(request);
  const output = { name: link, requestId: result.insertedId };
  res.json(output);
});

router.get('/request', ensureRole(role.uploader), async (req, res) => {
  const userId = req.user._id.toString();
  const db = await connectToDatabase();
  const result = await db.collection('requests').find({ userId }).toArray();
  res.json(result);
});

router.get('/request/:id', ensureRole(role.uploader), async (req, res) => {
  const { id } = req.params;
  const db = await connectToDatabase();
  const result = await db.collection('requests').findOne({ _id: new ObjectId(id) });
  res.json(result);
});

router.get('/media', ensureRole(role.viewer), async (req, res) => {
  const maxPageSize = 100;
  const userId = req.user._id.toString();
  let { page = 0, size = 100 } = req.query;
  page = Math.max(0, parseInt(page));
  size = Math.min(maxPageSize, parseInt(size));
  const db = await connectToDatabase();
  const result = await db.collection('videos').aggregate(
    [
      {
        $facet: {
          pageData: [
            { $match: { 'requests.userId': userId } },
            { $sort: { _id: -1 } },
            { $skip: page * size },
            { $limit: size },
            {
              $addFields: {
                requests: {
                  $filter: {
                    input: "$requests",
                    as: "item",
                    cond: { $eq: ["$$item.userId", userId] }
                  }
                }
              }
            },
            { $project: { extractedMetadata: 0 } }
          ],
          totalItems: [
            { $match: { 'requests.userId': userId } },
            { $count: 'totalCount' },
          ]
        }
      }
    ]
  ).toArray();
  let totalItems = 0;
  let pageData = [];
  if (result.length > 0 && result[0].totalItems.length > 0) {
    totalItems = result[0].totalItems[0].totalCount;
    pageData = result[0].pageData
  }
  res.json({
    totalItems,
    currentPage: page,
    totalPages: Math.ceil(totalItems / size),
    pageData,
  });
});


const filesDir = path.join(process.env.VIDEOS_PATH, 'File');
if (!fs.existsSync(filesDir)) { fs.mkdirSync(filesDir, { recursive: true }); }

const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dateStr = (new Date()).toISOString().replaceAll('-', '').slice(0, 8);
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileDir = path.join(filesDir, dateStr, 'user', randomId);
    if (!fs.existsSync(fileDir)) { fs.mkdirSync(fileDir, { recursive: true }); }
    cb(null, fileDir);
  },
  filename: function (req, file, cb) {
    const randomId = crypto.randomBytes(8).toString('hex');
    const fileName = `${randomId}${path.extname(file.originalname)}`;
    cb(null, fileName);
  }
});

const mediaUpload = multer({ storage: mediaStorage });

router.post('/media', ensureRole(role.uploader), mediaUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing uploaded file' });
  }

  const userId = req.user._id.toString();
  const { title, channel, transcription, fake, mediaType, modifiedDate } = req.body;
  const transcribeEnabled = Boolean(transcription);
  const fakeEnabled = Boolean(fake);
  const modTimestamp = parseInt(modifiedDate);
  const file = req.file;

  const datetimeStr = dateToISOStringPy(new Date());
  const modDatetimeStr = dateToISOStringPy(new Date(modTimestamp));

  const media = {
    requests: [
      {
        source: 'fileUpload',
        userId,
        url: null,
        requestDatetime: datetimeStr,
        priority: 1,
        analysisEnabled: { transcribe: transcribeEnabled, fake: fakeEnabled },
      }
    ],
    priority: 1,
    analysisStatus: {
      transcribe: transcribeEnabled ? "waiting" : "disabled",
      fake: fakeEnabled ? "waiting" : "disabled",
    },
    platform: 'file',
    status: 'downloaded',
    path: path.relative(process.env.VIDEOS_PATH, file.path),
    downloadDatetime: datetimeStr,
    mediaType,
    platformMetadata: {
      title: title || file.originalname || '',
      uploader: channel || '',
      uploadDatetime: datetimeStr,
      modifiedDatetime: modDatetimeStr,
      originFilename: file.originalname,
      duration: null,
    },
  };

  const db = await connectToDatabase();
  const result = await db.collection('videos').insertOne(media);
  const output = { name: file.originalname, mediaId: result.insertedId };
  res.json(output);
});

router.get('/media/:id', ensureRole(role.viewer), async (req, res) => {
  const userId = req.user._id.toString();
  const { id } = req.params;
  const db = await connectToDatabase();
  const result = await db.collection('videos').aggregate([
    { $match: { _id: new ObjectId(id) } },
    {
      $addFields: {
        requests: {
          $filter: {
            input: "$requests",
            as: "item",
            cond: { $eq: ["$$item.userId", userId] }
          }
        }
      }
    },
  ]).toArray();
  res.json(result[0]);
});

module.exports = router;
