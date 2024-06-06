const connectToDatabase = require('./conn.js');

const usersId = [
  '65832a6923c86d7d35f7e783',
  '65832a90de80541a2685025a',
];

const channelsId = [
  'hespress',
  'LibertadDigital',
  '7073459805905814534',
  'tvrain',
  'ChechuLeduc',
  'mundodesconocido',
  'Spanish_Revolution',
];

function dateToISOStringPy(date) {
  return date.toISOString().replace('Z', '+00:00');
}

const subscribeDatetime = dateToISOStringPy(new Date());

const newMonitoringUsers = usersId.map(userId => ({ userId, subscribeDatetime }));

const db = await connectToDatabase();
const res = await db.collection('watchlist').updateMany(
  { channelId: { $in: channelsId } },
  { $push: { monitoringUsers: { $each: newMonitoringUsers } } }
);

console.log(res)
