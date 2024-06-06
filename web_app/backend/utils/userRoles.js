const role = {
  viewer: "viewer",
  uploader: "uploader",
  editor: "editor",
};

const rolePermissions = {
  viewer: 1,
  uploader: 3,
  editor: 7
};

module.exports = { role, rolePermissions }
