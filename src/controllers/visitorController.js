const userService = require('../services/userService');
const { publicVisitor } = require('../middleware/visitor');

/** { visitor: null } for a browser that hasn't saved anything yet. */
exports.me = (req, res) => res.json({ visitor: publicVisitor(req.visitor) });

exports.updatePreferences = async (req, res) => {
  const visitor = await userService.updatePreferences(req.visitor.id, req.body);
  res.json({ visitor: publicVisitor(visitor) });
};
