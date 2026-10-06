const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EducationSchema = new mongoose.Schema({
  school: { type: String, required: true },
  degree: { type: String },
  fieldOfStudy: { type: String },
  startYear: { type: String },
  endYear: { type: String }
}, { _id: true });

const ExperienceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  location: { type: String },
  startDate: { type: String },
  endDate: { type: String },
  current: { type: Boolean, default: false },
  description: { type: String }
}, { _id: true });

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide your full name'],
    trim: true,
    maxlength: [80, 'Name cannot exceed 80 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email address'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  headline: {
    type: String,
    default: 'Professional at NEXORA',
    maxlength: [140, 'Headline cannot exceed 140 characters']
  },
  bio: {
    type: String,
    default: '',
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  location: {
    type: String,
    default: 'San Francisco, CA'
  },
  website: {
    type: String,
    default: ''
  },
  company: {
    type: String,
    default: ''
  },
  jobTitle: {
    type: String,
    default: ''
  },
  profilePicture: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },
  skills: [{
    type: String,
    trim: true
  }],
  education: [EducationSchema],
  experience: [ExperienceSchema],
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  themePreference: {
    type: String,
    enum: ['light', 'dark', 'system'],
    default: 'light'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for profile completion percentage
UserSchema.virtual('profileCompletion').get(function () {
  let score = 20; // baseline for created account with name & email
  if (this.headline && this.headline !== 'Professional at NEXORA') score += 15;
  if (this.bio && this.bio.length > 20) score += 15;
  if (this.profilePicture) score += 15;
  if (this.coverImage) score += 10;
  if (this.skills && this.skills.length > 0) score += 10;
  if (this.experience && this.experience.length > 0) score += 10;
  if (this.education && this.education.length > 0) score += 5;
  return Math.min(score, 100);
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match password helper
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Text index for search
UserSchema.index({ name: 'text', headline: 'text', company: 'text', skills: 'text', location: 'text' });

module.exports = mongoose.model('User', UserSchema);
