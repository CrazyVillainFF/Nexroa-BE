require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Connection = require('../models/Connection');
const Notification = require('../models/Notification');
const { connectDB } = require('../config/db');

const seedUsers = [
  {
    name: 'Elena Rostova',
    email: 'elena@nexora.io',
    password: 'password123',
    headline: 'VP of Product Design @ Stellaris AI | Ex-Airbnb Design Systems Lead',
    bio: 'Pioneering human-centered spatial computing and AI-assisted design systems. Passionate about craftsmanship, accessible typography, and building products that empower creativity. Speaker at Config & Awwwards.',
    location: 'San Francisco, CA',
    company: 'Stellaris AI',
    jobTitle: 'VP of Product Design',
    website: 'https://elenadesign.framer.media',
    profilePicture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    skills: ['Design Systems', 'Product Strategy', 'Figma', 'UX Architecture', 'Spatial UI', 'User Research'],
    experience: [
      {
        title: 'VP of Product Design',
        company: 'Stellaris AI',
        location: 'San Francisco, CA',
        startDate: '2023',
        endDate: 'Present',
        current: true,
        description: 'Leading a 30-person multidisciplinary product, brand, and design engineering team.'
      },
      {
        title: 'Staff Product Designer',
        company: 'Airbnb',
        location: 'San Francisco, CA',
        startDate: '2019',
        endDate: '2023',
        current: false,
        description: 'Spearheaded the next-gen Design System used by 1200+ engineers and designers.'
      }
    ],
    education: [
      {
        school: 'Stanford University',
        degree: 'Master of Science',
        fieldOfStudy: 'Human-Computer Interaction',
        startYear: '2016',
        endYear: '2018'
      }
    ]
  },
  {
    name: 'Marcus Vance',
    email: 'marcus@nexora.io',
    password: 'password123',
    headline: 'Principal Distributed Systems Architect @ CloudScale | Go & Rust Evangelist',
    bio: 'Building resilient low-latency backend infrastructure handling 100M+ requests per second. Open source contributor to Kubernetes and Tokio. Believer in zero-trust architectures and mechanical sympathy.',
    location: 'Seattle, WA',
    company: 'CloudScale Technologies',
    jobTitle: 'Principal Systems Architect',
    website: 'https://marcusvance.dev',
    profilePicture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80',
    skills: ['Distributed Systems', 'Rust', 'Go', 'Kubernetes', 'High Throughput DBs', 'Kafka', 'gRPC'],
    experience: [
      {
        title: 'Principal Systems Architect',
        company: 'CloudScale Technologies',
        location: 'Seattle, WA',
        startDate: '2021',
        endDate: 'Present',
        current: true,
        description: 'Architecting ultra-low latency global data meshes across multi-cloud regions.'
      }
    ],
    education: [
      {
        school: 'Carnegie Mellon University',
        degree: 'B.S. in Computer Science',
        fieldOfStudy: 'Distributed Systems',
        startYear: '2013',
        endYear: '2017'
      }
    ]
  },
  {
    name: 'Dr. Anya Sharma',
    email: 'anya@nexora.io',
    password: 'password123',
    headline: 'Chief AI Scientist @ Cognition Lab | PhD Oxford | Large Multimodal Models',
    bio: 'Researching reasoning topologies, multimodal tokenization, and alignment for frontier models. Author of 18+ papers across NeurIPS, ICML, and CVPR. Angel investor in deep-tech startups.',
    location: 'London, UK',
    company: 'Cognition Lab',
    jobTitle: 'Chief AI Scientist',
    website: 'https://anyasharma.ai',
    profilePicture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1200&auto=format&fit=crop&q=80',
    skills: ['Deep Learning', 'PyTorch', 'Transformers', 'Multimodal LLMs', 'Reinforcement Learning', 'AI Safety'],
    experience: [
      {
        title: 'Chief AI Scientist',
        company: 'Cognition Lab',
        location: 'London, UK',
        startDate: '2022',
        endDate: 'Present',
        current: true,
        description: 'Leading frontier foundational model architectures and reasoning benchmarks.'
      }
    ],
    education: [
      {
        school: 'University of Oxford',
        degree: 'PhD in Machine Learning',
        fieldOfStudy: 'Neural Information Processing',
        startYear: '2017',
        endYear: '2021'
      }
    ]
  },
  {
    name: 'Devon Thorne',
    email: 'devon@nexora.io',
    password: 'password123',
    headline: 'Co-Founder & CEO @ Nexus Robotics | Forbes 30 Under 30',
    bio: 'Scaling autonomous warehouse robotics. Obsessed with high velocity execution, radical transparency, and building products customers love. We are hiring across Hardware, Firmware, and Web platforms!',
    location: 'Austin, TX',
    company: 'Nexus Robotics',
    jobTitle: 'Co-Founder & CEO',
    website: 'https://nexusrobotics.tech',
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&auto=format&fit=crop&q=80',
    skills: ['Venture Capital', 'Product Leadership', 'Robotics', 'Go-To-Market', 'Team Building', 'Growth'],
    experience: [
      {
        title: 'Co-Founder & CEO',
        company: 'Nexus Robotics',
        location: 'Austin, TX',
        startDate: '2020',
        endDate: 'Present',
        current: true,
        description: 'Raised $45M Series B, grew team from 4 to 110 world-class engineers.'
      }
    ],
    education: [
      {
        school: 'MIT',
        degree: 'B.S. Electrical Engineering & CS',
        fieldOfStudy: 'Autonomous Systems',
        startYear: '2014',
        endYear: '2018'
      }
    ]
  },
  {
    name: 'Sarah Chen',
    email: 'sarah@nexora.io',
    password: 'password123',
    headline: 'Senior Engineering Manager @ Stripe | Building Global Financial Rails',
    bio: 'Passionate about engineering culture, mentoring high-performing teams, and building rock-solid developer platforms. Advocate for women in technology and developer joy.',
    location: 'New York, NY',
    company: 'Stripe',
    jobTitle: 'Senior Engineering Manager',
    website: 'https://sarahchen.me',
    profilePicture: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=500&auto=format&fit=crop&q=80',
    coverImage: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80',
    skills: ['Engineering Management', 'System Architecture', 'Fintech', 'TypeScript', 'Node.js', 'Mentorship'],
    experience: [
      {
        title: 'Senior Engineering Manager',
        company: 'Stripe',
        location: 'New York, NY',
        startDate: '2021',
        endDate: 'Present',
        current: true,
        description: 'Managing 3 squads driving core payments orchestration across EMEA and LATAM.'
      }
    ],
    education: [
      {
        school: 'Cornell University',
        degree: 'B.S. in Computer Science',
        fieldOfStudy: 'Software Engineering',
        startYear: '2012',
        endYear: '2016'
      }
    ]
  }
];

const seedPosts = [
  {
    userIndex: 0, // Elena
    content: `Thrilled to announce that our new design system at Stellaris AI is now fully operational! 🚀\n\nWe spent 6 months re-thinking how design tokens interact with autonomous UI generation. Instead of static components, our interface now dynamically adapts its density, contrast ratios, and spatial hierarchy based on ambient lighting and user workflow context.\n\nKey takeaways from our journey:\n1. Tokens > Static Specs\n2. Real-time feedback beats post-hoc QA\n3. Micro-interactions are the soul of premium enterprise software\n\nWhat are your thoughts on adaptive UI systems? #designsystems #ux #ai #productdesign`,
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000&auto=format&fit=crop&q=80'
  },
  {
    userIndex: 1, // Marcus
    content: `Hot take: Simplicity is the hardest architectural virtue to achieve in distributed systems.\n\nOver the past quarter, our team reduced our microservice count by 40% by consolidating cohesive domains into modular monoliths deployed as single Go binaries. The results?\n\n• 65% drop in end-to-end latency\n• 80% reduction in Cloud infrastructure spend\n• Zero distributed tracing nightmares during on-call\n\nAlways build for the problem you actually have today, not the hypothetical scale you might need in 5 years. #distributedsystems #golang #architecture #cloud`,
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1000&auto=format&fit=crop&q=80'
  },
  {
    userIndex: 2, // Dr. Anya
    content: `Our latest paper on "Chain-of-Perception in Multimodal Reasoning" is now live on arXiv! 🧠✨\n\nWe demonstrated that aligning visual saccades with latent reasoning steps improves complex scientific diagram understanding by +24.8% over standard attention models.\n\nBig shoutout to the incredible research team at Cognition Lab for their tireless experiments over the past 8 months. Link in profile! #machinelearning #deeplearning #artificialintelligence #research`,
    image: 'https://images.unsplash.com/photo-1617791160505-6f00504e3519?w=1000&auto=format&fit=crop&q=80'
  },
  {
    userIndex: 3, // Devon
    content: `Just closed our Series B round for Nexus Robotics! 🤖⚡️\n\nWhen we started out in a dusty Austin garage 4 years ago, people told us that warehouse automation was already a crowded commodity. Today, over 5,000 of our autonomous units navigate fulfillment centers with 99.998% uptime.\n\nTo all early stage founders: persist through the trough of sorrow. Focus on making 10 customers utterly obsessed with your product.\n\nWe are actively hiring 40+ roles across Hardware & Frontend engineering. DM me or visit our careers page! #startups #fundraising #robotics #entrepreneurship`,
    image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1000&auto=format&fit=crop&q=80'
  },
  {
    userIndex: 4, // Sarah
    content: `A reminder for all engineering managers entering Q4 planning:\n\nYour engineers do not burn out from hard work. They burn out from:\n• Ambiguous goals that shift weekly\n• Unnecessary meetings that fragment deep focus\n• Zero recognition for invisible maintenance work\n• Friction in their local development environment\n\nProtect your team's flow state and give them the autonomy to do what they do best. #engineering #leadership #management #developerproductivity`,
    image: ''
  }
];

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('[Seed] Clearing existing collections...');
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});
    await Connection.deleteMany({});
    await Notification.deleteMany({});

    console.log('[Seed] Creating demo users...');
    const createdUsers = [];
    for (const userData of seedUsers) {
      const user = await User.create(userData);
      createdUsers.push(user);
    }
    console.log(`[Seed] Created ${createdUsers.length} professional users.`);

    // Establish mutual connections
    console.log('[Seed] Connecting users...');
    // Elena connected with Marcus, Devon, Sarah
    const connectionsToCreate = [
      { requester: createdUsers[0]._id, recipient: createdUsers[1]._id, status: 'accepted' },
      { requester: createdUsers[0]._id, recipient: createdUsers[3]._id, status: 'accepted' },
      { requester: createdUsers[0]._id, recipient: createdUsers[4]._id, status: 'accepted' },
      { requester: createdUsers[1]._id, recipient: createdUsers[2]._id, status: 'accepted' },
      { requester: createdUsers[2]._id, recipient: createdUsers[3]._id, status: 'accepted' },
      { requester: createdUsers[1]._id, recipient: createdUsers[4]._id, status: 'pending' }, // pending request
      { requester: createdUsers[3]._id, recipient: createdUsers[4]._id, status: 'accepted' }
    ];

    for (const conn of connectionsToCreate) {
      await Connection.create(conn);
      if (conn.status === 'accepted') {
        await User.findByIdAndUpdate(conn.requester, {
          $addToSet: { connections: conn.recipient, followers: conn.recipient, following: conn.recipient }
        });
        await User.findByIdAndUpdate(conn.recipient, {
          $addToSet: { connections: conn.requester, followers: conn.requester, following: conn.requester }
        });
      }
    }

    console.log('[Seed] Creating sample posts, likes, and comments...');
    for (let i = 0; i < seedPosts.length; i++) {
      const pData = seedPosts[i];
      const author = createdUsers[pData.userIndex];

      const post = await Post.create({
        author: author._id,
        content: pData.content,
        image: pData.image,
        likes: [
          createdUsers[(pData.userIndex + 1) % createdUsers.length]._id,
          createdUsers[(pData.userIndex + 2) % createdUsers.length]._id
        ]
      });

      // Add realistic comments
      const comment1 = await Comment.create({
        post: post._id,
        author: createdUsers[(pData.userIndex + 1) % createdUsers.length]._id,
        content: 'Fascinating perspective! Would love to dive deeper into how this impacts latency under high concurrency.'
      });

      const comment2 = await Comment.create({
        post: post._id,
        author: createdUsers[(pData.userIndex + 2) % createdUsers.length]._id,
        content: 'Couldn’t agree more. Outstanding work and congratulations to the entire team on this milestone! 👏'
      });

      post.comments.push(comment1._id, comment2._id);
      await post.save();
    }

    // Create realistic demo notifications for Elena
    await Notification.create({
      recipient: createdUsers[0]._id,
      sender: createdUsers[1]._id,
      type: 'post_like',
      message: 'Marcus Vance liked your post about the new design system.'
    });

    await Notification.create({
      recipient: createdUsers[0]._id,
      sender: createdUsers[2]._id,
      type: 'post_comment',
      message: 'Dr. Anya Sharma commented on your post: "Outstanding work and congratulations..."'
    });

    await Notification.create({
      recipient: createdUsers[0]._id,
      sender: createdUsers[3]._id,
      type: 'connection_accepted',
      message: 'Devon Thorne accepted your connection request. You are now connected!'
    });

    console.log('[Seed] Database successfully seeded with rich professional data!');
    console.log('\n[Demo Accounts Created]:');
    seedUsers.forEach(u => {
      console.log(`  • Email: ${u.email} | Password: password123 | ${u.name} (${u.jobTitle})`);
    });

    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
