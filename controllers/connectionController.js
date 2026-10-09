const Connection = require('../models/Connection');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Send connection request to a user
// @route   POST /api/connections/:userId
// @access  Private
const sendConnectionRequest = async (req, res, next) => {
  try {
    const recipientId = req.params.userId;
    const requesterId = req.user._id;

    if (recipientId.toString() === requesterId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a connection request to yourself.'
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Check if connection or request already exists in either direction
    const existing = await Connection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId }
      ]
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'You are already connected with this user.'
        });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({
          success: false,
          message: existing.requester.toString() === requesterId.toString()
            ? 'Connection request already sent.'
            : 'This user has already sent you a connection request. Please accept it.'
        });
      }
    }

    const connection = await Connection.create({
      requester: requesterId,
      recipient: recipientId,
      status: 'pending'
    });

    // Create Notification
    await Notification.findOneAndUpdate(
      { recipient: recipientId, connection: connection._id, type: 'connection_request' },
      { $setOnInsert: {
        recipient: recipientId,
        sender: requesterId,
        connection: connection._id,
        type: 'connection_request',
        message: `${req.user.name} sent you a connection request.`
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({
      success: true,
      message: 'Connection request sent successfully.',
      connection
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept connection request
// @route   PUT /api/connections/:requestId/accept
// @access  Private
const acceptConnectionRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.user._id;

    // Find request where current user is the recipient (or by ID)
    let connection = await Connection.findOne({
      _id: requestId,
      recipient: currentUserId,
      status: 'pending'
    });

    // Also support finding by requester ID if someone passes sender's user ID
    if (!connection) {
      connection = await Connection.findOne({
        requester: requestId,
        recipient: currentUserId,
        status: 'pending'
      });
    }

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Pending connection request not found or already accepted.'
      });
    }

    connection.status = 'accepted';
    await connection.save();

    // Update both users' connections array
    await User.findByIdAndUpdate(connection.requester, {
      $addToSet: { connections: connection.recipient, followers: connection.recipient, following: connection.recipient }
    });

    await User.findByIdAndUpdate(connection.recipient, {
      $addToSet: { connections: connection.requester, followers: connection.requester, following: connection.requester }
    });

    // Notify requester that their connection request was accepted
    await Notification.findOneAndUpdate(
      { recipient: connection.requester, connection: connection._id, type: 'connection_accepted' },
      { $setOnInsert: {
        recipient: connection.requester,
        sender: currentUserId,
        connection: connection._id,
        type: 'connection_accepted',
        message: `${req.user.name} accepted your connection request. You are now connected!`
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Connection accepted!',
      connection
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reject or cancel connection request
// @route   DELETE /api/connections/:requestId
// @access  Private
const rejectOrRemoveConnection = async (req, res, next) => {
  try {
    const targetId = req.params.requestId;
    const currentUserId = req.user._id;

    // Search either by connection ID or other user's ID
    const connection = await Connection.findOne({
      $or: [
        { _id: targetId },
        { requester: currentUserId, recipient: targetId },
        { requester: targetId, recipient: currentUserId }
      ]
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        message: 'Connection record not found.'
      });
    }

    // Authorization check
    if (
      connection.requester.toString() !== currentUserId.toString() &&
      connection.recipient.toString() !== currentUserId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this connection.'
      });
    }

    // If it was accepted, pull from both users' connection lists
    if (connection.status === 'accepted') {
      await User.findByIdAndUpdate(connection.requester, {
        $pull: { connections: connection.recipient }
      });
      await User.findByIdAndUpdate(connection.recipient, {
        $pull: { connections: connection.requester }
      });
    }

    await Connection.findByIdAndDelete(connection._id);

    res.status(200).json({
      success: true,
      message: 'Connection removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user connections & pending requests
// @route   GET /api/connections
// @access  Private
const getConnections = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    // Accepted connections
    const accepted = await Connection.find({
      $or: [{ requester: currentUserId }, { recipient: currentUserId }],
      status: 'accepted'
    })
      .populate('requester', 'name headline profilePicture company jobTitle location')
      .populate('recipient', 'name headline profilePicture company jobTitle location');

    const connectionsList = accepted.map(c => {
      return c.requester._id.toString() === currentUserId.toString()
        ? c.recipient
        : c.requester;
    });

    // Pending incoming requests (sent to current user)
    const pendingIncoming = await Connection.find({
      recipient: currentUserId,
      status: 'pending'
    }).populate('requester', 'name headline profilePicture company jobTitle location');

    // Pending outgoing requests (sent by current user)
    const pendingOutgoing = await Connection.find({
      requester: currentUserId,
      status: 'pending'
    }).populate('recipient', 'name headline profilePicture company jobTitle location');

    res.status(200).json({
      success: true,
      count: connectionsList.length,
      connections: connectionsList,
      pendingIncoming,
      pendingOutgoing
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectOrRemoveConnection,
  getConnections
};
