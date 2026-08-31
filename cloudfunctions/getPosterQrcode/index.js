// 生成小程序码（海报用），上传到云存储返回 fileID
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  try {
    const res = await cloud.openapi.wxacode.getUnlimited({
      scene: 'poster',
      page: 'pages/index/index',
      width: 280,
      checkPath: false,
      envVersion: 'release'
    });
    if (!res.buffer) return { success: false, error: res.errMsg || 'no buffer' };
    const upload = await cloud.uploadFile({
      cloudPath: 'poster-qrcode.png',
      fileContent: res.buffer
    });
    return { success: true, fileID: upload.fileID };
  } catch (e) {
    return { success: false, error: e.errMsg || e.message };
  }
};
