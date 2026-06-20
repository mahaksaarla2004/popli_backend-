import { PrismaClient } from '@prisma/client';
import { NotificationsService } from './src/notifications/notifications.service';

const prisma = new PrismaClient();
const notifService = new NotificationsService(prisma as any);

async function run() {
  console.log('--- STARTING NOTIFICATION VALIDATION ---');
  
  // 1. Setup mock users and reels
  const u1 = await prisma.user.upsert({
    where: { username: 'test_receiver' },
    update: {},
    create: { name: 'Receiver', username: 'test_receiver', email: 'r@r.com', phone: '111111' }
  });
  const u2 = await prisma.user.upsert({
    where: { username: 'test_actor1' },
    update: {},
    create: { name: 'Actor 1', username: 'test_actor1', email: 'a1@a.com', phone: '222222' }
  });
  const u3 = await prisma.user.upsert({
    where: { username: 'test_actor2' },
    update: {},
    create: { name: 'Actor 2', username: 'test_actor2', email: 'a2@a.com', phone: '333333' }
  });

  const reel = await prisma.reel.upsert({
    where: { id: 'test_reel_1' },
    update: { creatorId: u1.id },
    create: { id: 'test_reel_1', creatorId: u1.id, mediaUrl: 'test', thumbnailUrl: 'test_thumb.jpg', description: 'test', privacy: 'Public', category: 'comedy' }
  });

  // Clear existing notifications for receiver
  await prisma.notification.deleteMany({ where: { userId: u1.id } });

  console.log('1. Testing LIKE aggregation...');
  await prisma.notification.create({
    data: { userId: u1.id, senderId: u2.id, type: 'LIKE', title: 'test', body: 'test', postId: reel.id, metaData: { targetType: 'REEL', reelThumbnail: reel.thumbnailUrl } }
  });
  await prisma.notification.create({
    data: { userId: u1.id, senderId: u3.id, type: 'LIKE', title: 'test', body: 'test', postId: reel.id, metaData: { targetType: 'REEL', reelThumbnail: reel.thumbnailUrl } }
  });

  console.log('2. Testing COMMENT...');
  await prisma.notification.create({
    data: { userId: u1.id, senderId: u2.id, type: 'COMMENT', title: 'test', body: 'test', postId: reel.id, commentId: 'c1', metaData: { targetType: 'REEL', reelThumbnail: reel.thumbnailUrl, commentText: 'Nice video!' } }
  });

  console.log('3. Testing MENTION...');
  await prisma.notification.create({
    data: { userId: u1.id, senderId: u3.id, type: 'MENTION', title: 'test', body: 'test', postId: reel.id, commentId: 'c2', metaData: { targetType: 'REEL', reelThumbnail: reel.thumbnailUrl, commentText: '@test_receiver hey!' } }
  });

  console.log('4. Testing FOLLOW...');
  await prisma.notification.create({
    data: { userId: u1.id, senderId: u2.id, type: 'FOLLOW', title: 'test', body: 'test', metaData: { targetType: 'USER' } }
  });

  console.log('5. Testing GIFT...');
  await prisma.notification.create({
    data: { userId: u1.id, senderId: u2.id, type: 'GIFT' as any, title: 'test', body: 'test', postId: reel.id, metaData: { targetType: 'REEL', giftType: 'Rose', giftAmount: 10 } }
  });

  const res = await notifService.getNotifications(u1.id);
  console.log(JSON.stringify(res.notifications, null, 2));

  const unread = await notifService.getUnreadCount(u1.id);
  console.log(`Unread Count: ${unread.count}`);

  console.log('--- DONE ---');
}

run().catch(console.error).finally(() => prisma.$disconnect());
