const Connection = require('../models/Connection');
const User = require('../models/User');

const isAcceptedConnection = async (viewerId, authorId) => {
  if (!viewerId || !authorId) return false;
  if (viewerId.toString() === authorId.toString()) return true;
  return Boolean(await Connection.exists({
    status: 'accepted',
    $or: [
      { requester: viewerId, recipient: authorId },
      { requester: authorId, recipient: viewerId }
    ]
  }));
};

const canViewUserPosts = async (viewerId, author) => {
  if (!author?.privateAccount) return true;
  return isAcceptedConnection(viewerId, author._id);
};

const postVisibilityFilter = async (viewerId) => {
  const privateUsers = await User.find({ privateAccount: true }).select('_id').lean();
  if (!privateUsers.length) return null;

  const allowedIds = new Set(viewerId ? [viewerId.toString()] : []);
  if (viewerId) {
    const accepted = await Connection.find({
      status: 'accepted',
      $or: [{ requester: viewerId }, { recipient: viewerId }]
    }).select('requester recipient').lean();

    accepted.forEach((connection) => {
      const other = connection.requester.toString() === viewerId.toString()
        ? connection.recipient
        : connection.requester;
      allowedIds.add(other.toString());
    });
  }

  const privateIds = privateUsers.map(({ _id }) => _id);
  const visiblePrivateIds = privateUsers
    .filter(({ _id }) => allowedIds.has(_id.toString()))
    .map(({ _id }) => _id);

  return {
    $or: [
      { author: { $nin: privateIds } },
      { author: { $in: visiblePrivateIds } }
    ]
  };
};

const addPostVisibility = (query, visibilityFilter) => {
  if (!visibilityFilter) return query;
  if (Object.keys(query).length === 0) return visibilityFilter;
  return { $and: [query, visibilityFilter] };
};

module.exports = { isAcceptedConnection, canViewUserPosts, postVisibilityFilter, addPostVisibility };
