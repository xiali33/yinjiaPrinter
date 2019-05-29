const api = 'https://it.941in.com/';
const debug = false;   //正式环境false

// 获得系统信息
const getSystemInfo = () => {
  let systemInfo = wx.getStorageSync('systemInfo');
  if (!systemInfo) {
    systemInfo = {
      platform: '',
      delayTime: 0,
    };
    const res = wx.getSystemInfoSync();
    systemInfo.platform = res.platform;
    if (res.platform === 'android') {
      systemInfo.delayTime = 100;
    }
    wx.setStorageSync('systemInfo', systemInfo);
  }
}

// 请求
const request = (url, data = {}, method = 'POST', header) => {
  let _this = this;
  for (let key in data) {
    if (typeof data[key] === 'undefined') {
      delete data[key];
    } else if (data[key] === '') {
      delete data[key];
    } else if (data[key] == 'ISNULL') {
      data[key] = '';
    }
  };

  // 是否携带token 只有登录接口不需要
  let src = '';
  if (url === 'api.php?m=public&a=login') {
    src = api + url;
  } else {
    let token = wx.getStorageSync('token');
    let signtime = wx.getStorageSync('signtime');
    if (token && signtime) {
      src = api + url + '&token=' + token + '&signtime=' + signtime;
    } else {
      wx.reLaunch({
        url: '/pages/login/login'
      })
    }
  }
  header = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  return new Promise((resolve, reject)=>{
    wx.request({
      url: src,
      header: header,
      method: method,
      data: data,
      success: function (res) {
        let result = res.data;
        if (parseInt(result.status) === 0) {
          resolve(result.data);
        } else if (result.status === 1111 || result.status === 1112 || result.status === 1120 || result.status === 1122 || result.status === 1123) {
          // token有误，重新登录请求
          wx.reLaunch({
            url: '/pages/login/login'
          })
        } else {
          if (debug) {
            console.log(result);
          }
          reject(result);
        }
      },
      fail: function (error) {
        if (debug) {
          console.log(error);
        }
        reject(error);
      },
    });
  });
}

const ARuploadFile = (url, filePath, name) => {
  return new Promise((resolve, reject) => {
    let token = wx.getStorageSync('token');
    let signtime = wx.getStorageSync('signtime');
    let src = url;
    if (token && signtime) {
      src = api + url + '&token=' + token + '&signtime=' + signtime;
    } else {
      wx.reLaunch({
        url: '/pages/login/login'
      })
    }
    wx.uploadFile({
      url: src,
      filePath: filePath,
      name: name,
      success: res => {
        let msg = JSON.parse(res.data);
        if (msg.status === 0) {
          resolve(msg.data);
        } else if (msg.status === 1111 || msg.status === 1112 || msg.status === 1120 || msg.status === 1122 || msg.status === 1123 || msg.status === 1125) {
          // token有误，重新登录请求
          wx.reLaunch({
            url: '/pages/login/login'
          })
        } else {
          if (debug) {
            console.log(msg);
          }
          reject('未识别到目标，请点击屏幕继续识别');
        }
      },
      fail: err => {
        if (debug) {
          console.log(err);
        }
        reject(JSON.stringify(err));
      }
    });
  })
}

// 登录请求
const loginRequest = (userInfo) => {
  return new Promise((resolve, reject) => {
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          let data = {
            platTypeId: 1,   // 1等于 微信小程序
            code: res.code,
            rawData: userInfo.rawData,
            signature: userInfo.signature,
            encryptedData: userInfo.encryptedData,
            iv: userInfo.iv,
          };
          // 请求获取 token signtime
          request('api.php?m=public&a=login', data).then((res) => {
            if (res.token) {
              wx.setStorageSync('token', res.token);
            }
            if (res.signtime) {
              wx.setStorageSync('signtime', res.signtime);
            }
            if (res.expiretime) {
              wx.setStorageSync('expiretime', res.expiretime);
            }
            resolve(res);
          }).catch(error => {
            if (debug) {
              console.log(error)
            }
            reject(error);
          })
        } else {
          if (debug) {
            console.log('登录失败！' + res.errMsg)
          }
          reject(res.errMsg);
        }
      }
    });
  })
}

// 上传图片到服务器
const uploadImg = (imgUrl, goodId, paperId, arVideoId) => {
  return new Promise((resolve, reject) => {
    let formData = {
      goodId: goodId,
      printerId: 0,
      paperId: 0,
    };
    if (paperId) {
      formData.printerId = wx.getStorageSync('printerId');
      formData.paperId = paperId;
    } else {
      // 请求服务器上传图片
      let paperInfo = wx.getStorageSync('paperInfo');
      formData.printerId = paperInfo.printerId;
      formData.paperId = paperInfo.paperId;
    }
    if (arVideoId) {
      formData.arVideoId = arVideoId;
    }
    let token = wx.getStorageSync('token'),
      signtime = wx.getStorageSync('signtime');
    if (token && signtime) {
      wx.uploadFile({
        url: api + 'api.php?m=usermedia&a=upload&token=' + token + '&signtime=' + signtime,
        filePath: imgUrl,
        name: 'imgData',
        formData: formData,
        success(res) {
          let result = JSON.parse(res.data);
          if (result.status === 0) {
            resolve(result);
          } else {
            if (debug) {
              console.log(result);
            }
            reject(result);
          }
        },
        fail(error) {
          if (debug) {
            console.log(error);
          }
          reject(error);
        }
      })
    } else {
      // token不存在 跳转到登录页
      wx.reLaunch({
        url: '/pages/login/login'
      })
    }
  });
}

// canvas生成图片
const makePicture = (paper) => {
  return new Promise((resolve, reject)=>{
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, paper.width, paper.height);

    // 设置坐标信息
    ctx.translate(paper.picture.translateX, paper.picture.translateY);
    ctx.scale(paper.picture.scale, paper.picture.scale);
    ctx.rotate(paper.picture.rotate * Math.PI / 180);
    
    // 画出背景图
    ctx.drawImage(paper.picture.url, -paper.picture.width / 2, -paper.picture.height/2, paper.picture.width, paper.picture.height);

    // 返回左上角原点坐标信息
    ctx.rotate(-paper.picture.rotate * Math.PI / 180);
    ctx.scale(1 / paper.picture.scale, 1 / paper.picture.scale);
    ctx.translate(-paper.picture.translateX, -paper.picture.translateY);

    // 边框
    if (paper.frame && paper.frame.url !== '') {
      // 画出边框
      ctx.drawImage(paper.frame.url, 0, 0, paper.width, paper.height);
    }

    // 贴图
    if (paper.chartlet && paper.chartlet.length > 0) {
      for (let i = 0; i < paper.chartlet.length; i++) {
        // 设置坐标信息
        ctx.translate(paper.chartlet[i].translateX, paper.chartlet[i].translateY);
        ctx.scale(paper.chartlet[i].scale, paper.chartlet[i].scale);
        ctx.rotate(paper.chartlet[i].rotate * Math.PI / 180);

        // 画出贴图
        ctx.drawImage(paper.chartlet[i].url, -paper.chartlet[i].width / 2, -paper.chartlet[i].height / 2, paper.chartlet[i].width, paper.chartlet[i].height);

        // 返回左上角原点坐标信息
        ctx.rotate(-paper.chartlet[i].rotate * Math.PI / 180);
        ctx.scale(1 / paper.chartlet[i].scale, 1 / paper.chartlet[i].scale);
        ctx.translate(-paper.chartlet[i].translateX, -paper.chartlet[i].translateY);
      }
    }

    // 文字 只能输入一行，这里实现的是汉子输入多行效果
    let j = 1, zeroIndex = 0, text_y = 0, floorZeroIndex = 0;
    if (paper.texts && paper.texts.length > 0) {
      for (let i = 0; i < paper.texts.length; i++) {
        // 设置坐标信息
        ctx.translate(paper.texts[i].translateX, paper.texts[i].translateY);
        ctx.scale(paper.texts[i].scale, paper.texts[i].scale);
        ctx.rotate(paper.texts[i].rotate * Math.PI / 180);

        // 设置文字信息
        ctx.setFillStyle(paper.texts[i].color);
        ctx.font = paper.texts[i].fontSize + 'px ' + paper.texts[i].fontFamily;
        ctx.setTextAlign('center');
        ctx.setTextBaseline('middle');

        zeroIndex = (paper.texts[i].lineCount) / 2;
        floorZeroIndex = zeroIndex = Math.floor((paper.texts[i].lineCount) / 2);
        for (let j = 0; j < paper.texts[i].lineCount; j++) {
          // 绘制文本
          let isInt = isInteger(zeroIndex);
          if (isInt) {
            // 除2可整除 text_y每行文字的Y轴坐标
            text_y = -paper.texts[i].lineHeight / 2 + ((j - zeroIndex) * paper.texts[i].lineHeight);
          } else {
            //  除2不可整除
            text_y = paper.texts[i].lineHeight * (j - floorZeroIndex);
          }
          if (j !== paper.texts[i].lineCount - 1) {
            ctx.fillText(paper.texts[i].text.substr(paper.texts[i].rowCount * j, paper.texts[i].rowCount), 0, text_y);
          } else {
            ctx.fillText(paper.texts[i].text.substr(paper.texts[i].rowCount * j), 0, text_y);
          }
        }

        // 返回左上角原点坐标信息
        ctx.rotate(-paper.texts[i].rotate * Math.PI / 180);
        ctx.scale(1 / paper.texts[i].scale, 1 / paper.texts[i].scale);
        ctx.translate(-paper.texts[i].translateX, -paper.texts[i].translateY);
      }
    }

    let _this = this,
      systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      // 生成图片
      setTimeout(function() {
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: paper.width,
          height: paper.height,
          destWidth: paper.width,
          destHeight: paper.height,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            paper.picture.url = res.tempFilePath;
            paper.picture.x = 0;
            paper.picture.y = 0;
            paper.picture.width = paper.width;
            paper.picture.height = paper.height;
            paper.picture.scale = 1;
            paper.picture.translateX = paper.width / 2;
            paper.picture.translateY = paper.height / 2;
            paper.picture.rotate = 0;
            paper.picture.origin.width = paper.width;
            paper.picture.origin.height = paper.height;
            paper.picture.origin.whscale = paper.width / paper.height;
            if (paper.frame) {
              paper.frame.url = '';
            }
            delete paper.chartlet;
            delete paper.texts;
            wx.setStorageSync('paper', paper);
            // 隐藏加载
            wx.hideLoading();
            resolve(paper);
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              showCancel: false,
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this)
      }, systemInfo.delayTime)
    });
  });
}

// canvas生成头像
const makeAvatar = (avatarData) => {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, avatarData.width, avatarData.height);

    // 设置坐标信息
    ctx.translate(avatarData.picture.translateX, avatarData.picture.translateY);
    ctx.scale(avatarData.picture.scale, avatarData.picture.scale);

    // 画出背景图
    ctx.drawImage(avatarData.picture.url, -avatarData.picture.width / 2, -avatarData.picture.height / 2, avatarData.picture.width, avatarData.picture.height);

    // 返回左上角原点坐标信息
    ctx.scale(1 / avatarData.picture.scale, 1 / avatarData.picture.scale);
    ctx.translate(-avatarData.picture.translateX, -avatarData.picture.translateY);

    let _this = this,
      systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: avatarData.width,
          height: avatarData.height,
          destWidth: avatarData.width,
          destHeight: avatarData.height,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            resolve(res.tempFilePath);
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this)
      }, systemInfo.delayTime);
    });
  });
} 

// canvas生成拼图图片
const makeSpellPic = (paper, _this) => {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, paper.width, paper.height);

    // 循环画图
    for (let i = 0; i < paper.listData.length; i++) {
      ctx.drawImage(paper.listData[i].url, paper.listData[i].x, paper.listData[i].y, paper.listData[i].w, paper.listData[i].h);
    }

    if (paper.border) {
      //画线条
      ctx.setStrokeStyle('#ffffff');
      ctx.setLineWidth(paper.border * 2);
      ctx.strokeRect(0, 0, paper.width, paper.height);
    }

    // 生成图片
    let systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: paper.width,
          height: paper.height,
          destWidth: paper.width,
          destHeight: paper.height,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            // 隐藏加载
            wx.hideLoading();
            paper.url = res.tempFilePath;
            // 保存paper
            wx.setStorageSync('paper', paper);
            wx.navigateTo({
              url: '/pages/makeImg/makeImg?type=1'
            })
            resolve(res.tempFilePath);
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this)
      }, systemInfo.delayTime)
    });
  });
}

// 生成其中一张拼图纸张
const makeSpellAlone = (paperTotal, paper, index, _this) => {
  return new Promise((resolve, reject) => {
    let i = index;
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, paperTotal.width, paperTotal.height);

    // 设置坐标信息
    ctx.translate(paper.picture.translateX, paper.picture.translateY);
    ctx.scale(paper.picture.scale, paper.picture.scale);

    // 画出背景图
    ctx.drawImage(paper.picture.url, -paper.picture.width / 2, -paper.picture.height / 2, paper.picture.width, paper.picture.height);

    // 返回左上角原点坐标信息
    ctx.scale(1 / paper.picture.scale, 1 / paper.picture.scale);
    ctx.translate(-paper.picture.translateX, -paper.picture.translateY);

    if (paperTotal.border) {
      //画线条
      ctx.setStrokeStyle('#ffffff');
      ctx.setLineWidth(paperTotal.border);
      ctx.strokeRect(0, 0, paper.w, paper.h);
    }
    let systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: paper.w,
          height: paper.h,
          destWidth: paper.w,
          destHeight: paper.h,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            paperTotal.listData[i].url = res.tempFilePath;
            resolve(paperTotal);
            i++;
            if (i < paperTotal.listData.length) {
              return makeSpellAlone(paperTotal, paperTotal.listData[i], i, _this).then(res => {
                if (i === paperTotal.listData.length - 1) {
                  return makeSpellPic(paperTotal, _this);
                }
              });
            }
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this)
      }, systemInfo.delayTime)
    });
  });
};

// 生成一张证件照
const makeOnePerson = (part, distance) => {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, distance, distance);

    // 设置坐标信息
    ctx.translate(part.picture.translateX, part.picture.translateY);
    ctx.scale(part.picture.scale, part.picture.scale);

    // 画出背景图
    ctx.drawImage(part.picture.url, -part.picture.width / 2, -part.picture.height / 2, part.picture.width, part.picture.height);

    // 返回左上角原点坐标信息
    ctx.scale(1 / part.picture.scale, 1 / part.picture.scale);
    ctx.translate(-part.picture.translateX, -part.picture.translateY);

    let _this = this,
      systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: part.width,
          height: part.height,
          destWidth: part.width,
          destHeight: part.height,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            if (res.tempFilePath) {
              part.picture.url = res.tempFilePath;
              part.picture.x = 0;
              part.picture.y = 0;
              part.picture.width = part.width;
              part.picture.height = part.height;
              part.picture.init_x = 0;
              part.picture.init_y = 0;
              part.picture.translateX = part.width / 2;
              part.picture.translateY = part.height / 2;
              part.picture.scale = 1;
              part.picture.origin.width = part.width;
              part.picture.origin.height = part.height;
              part.picture.origin.whscale = part.width / part.height;
              resolve(part);
            } else {
              if (debug) {
                console.log(res);
              }
              reject(res);
            }

          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this);
      }, systemInfo.delayTime);
    });
  });
};

// 生成列表图片
const makeListPerson = (paper) => {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, paper.width, paper.height);

    // 画出背景图
    for (let i = 0; i <= paper.tmplData.rows; i++) {
      for (let j = 0; j <= paper.tmplData.cols; j++) {
        ctx.drawImage(paper.tmplData.url, paper.tmplData.x + (paper.tmplData.w + paper.tmplData.mr) * (j - 1), paper.tmplData.y + (paper.tmplData.h + paper.tmplData.mt) * (i - 1), paper.tmplData.w, paper.tmplData.h);
      }
    }

    let _this = this,
      systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: paper.width,
          height: paper.height,
          destWidth: paper.width,
          destHeight: paper.height,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            if (res.tempFilePath) {
              resolve(res.tempFilePath);
            } else {
              if (debug) {
                console.log(res);
              }
              reject(res);
            }
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this);
      }, systemInfo.delayTime);
    });

  });
}

// 生成名片
const makeCart = (paper, cartData) => {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, paper.width, paper.width);

    // 画出头像
    ctx.drawImage(cartData.avatarUrl, paper.cart.tmplData.content.headimg.x, paper.cart.tmplData.content.headimg.y, paper.cart.tmplData.content.headimg.w, paper.cart.tmplData.content.headimg.h);

    // 画出名片背景
    ctx.drawImage(paper.cart.url, 0, 0, paper.cart.tmplData.w, paper.cart.tmplData.h);

    // 文字部分
    ctx.setTextBaseline('middle');
    // 写地址
    // 设置文字信息
    ctx.setFillStyle(paper.cart.tmplData.content.addr.color);
    ctx.font = paper.cart.tmplData.content.addr.size + 'px ' + paper.cart.tmplData.content.addr.family;
    ctx.setTextAlign(paper.cart.tmplData.content.addr.align);
    // 绘制文本
    ctx.fillText(cartData.address, paper.cart.tmplData.content.addr.x, paper.cart.tmplData.content.addr.y);

    // 写公司名称
    // 设置文字信息
    ctx.setFillStyle(paper.cart.tmplData.content.company.color);
    ctx.font = paper.cart.tmplData.content.company.size + 'px ' + paper.cart.tmplData.content.company.family;
    ctx.setTextAlign(paper.cart.tmplData.content.company.align);
    // 绘制文本
    ctx.fillText(cartData.company, paper.cart.tmplData.content.company.x, paper.cart.tmplData.content.company.y);

    // 写邮箱
    // 设置文字信息
    ctx.setFillStyle(paper.cart.tmplData.content.email.color);
    ctx.font = paper.cart.tmplData.content.email.size + 'px ' + paper.cart.tmplData.content.email.family;
    ctx.setTextAlign(paper.cart.tmplData.content.email.align);
    // 绘制文本
    ctx.fillText(cartData.email, paper.cart.tmplData.content.email.x, paper.cart.tmplData.content.email.y);

    // 写姓名
    // 设置文字信息
    ctx.setFillStyle(paper.cart.tmplData.content.name.color);
    ctx.font = paper.cart.tmplData.content.name.size + 'px ' + paper.cart.tmplData.content.name.family;
    ctx.setTextAlign(paper.cart.tmplData.content.name.align);
    // 绘制文本
    ctx.fillText(cartData.name, paper.cart.tmplData.content.name.x, paper.cart.tmplData.content.name.y);

    // 写职称
    // 设置文字信息
    ctx.setFillStyle(paper.cart.tmplData.content.professor.color);
    ctx.font = paper.cart.tmplData.content.professor.size + 'px ' + paper.cart.tmplData.content.professor.family;
    ctx.setTextAlign(paper.cart.tmplData.content.professor.align);
    // 绘制文本
    ctx.fillText(cartData.professor, paper.cart.tmplData.content.professor.x, paper.cart.tmplData.content.professor.y);

    // 写电话
    // 设置文字信息
    ctx.setFillStyle(paper.cart.tmplData.content.tel.color);
    ctx.font = paper.cart.tmplData.content.tel.size + 'px ' + paper.cart.tmplData.content.tel.family;
    ctx.setTextAlign(paper.cart.tmplData.content.tel.align);
    // 绘制文本
    ctx.fillText(cartData.tel, paper.cart.tmplData.content.tel.x, paper.cart.tmplData.content.tel.y);


    let _this = this,
      systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: 0,
          y: 0,
          width: paper.cart.tmplData.w,
          height: paper.cart.tmplData.h,
          destWidth: paper.cart.tmplData.w,
          destHeight: paper.cart.tmplData.h,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            if (res.tempFilePath) {
              resolve(res.tempFilePath);
            } else {
              if (debug) {
                console.log(res);
              }
              reject(res);
            }
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this)
      }, systemInfo.delayTime);
    });

  });
}

// 旋转并生成名片
const makeRotateImg = (paper) => {
  return new Promise((resolve, reject) => {
    const ctx = wx.createCanvasContext('canvas');
    ctx.setFillStyle('#fff')
    ctx.fillRect(0, 0, paper.distance, paper.distance);

    // 设置坐标信息
    ctx.translate(paper.distance / 2, paper.distance / 2);
    ctx.rotate(90 * Math.PI / 180);

    // 画出背景图
    ctx.drawImage(paper.url, -paper.width / 2, -paper.height / 2, paper.width, paper.height);

    // 返回左上角原点坐标信息
    ctx.rotate(-90 * Math.PI / 180);
    ctx.translate(-paper.distance / 2, -paper.distance / 2);

    let toTempFile = {
      x: (paper.distance - paper.height) / 2,
      y: (paper.distance - paper.width) / 2,
      width: paper.height,
      height: paper.width,
    }, _this = this;

    let systemInfo = wx.getStorageSync('systemInfo');
    ctx.draw(true, function () {
      setTimeout(function() {
        // 生成图片
        wx.canvasToTempFilePath({
          x: toTempFile.x,
          y: toTempFile.y,
          width: toTempFile.width,
          height: toTempFile.height,
          destWidth: toTempFile.width,
          destHeight: toTempFile.height,
          canvasId: 'canvas',
          quality: 1,
          fileType: 'jpg',
          success(res) {
            if (res.tempFilePath) {
              resolve(res.tempFilePath);
            } else {
              if (debug) {
                console.log(res);
              }
              reject(res);
            }
          },
          fail(error) {
            wx.showModal({
              title: "提示",
              content: "图片导出失败，请稍后在尝试"
            })
            // 隐藏加载
            wx.hideLoading();
            if (debug) {
              console.log(error);
            }
            reject(error);
          }
        }, _this)
      }, systemInfo.delayTime);
    });

  });
}

// 判断是否是整数
const isInteger = (num) => {
  if (!isNaN(num) && num % 1 === 0) {
    return true;
  } else {
    return false;
  }
}

// 去掉前后空格
const trim = (str) => {
  return str.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
}

// 通用初始化显示
const showPaper = (_this) => {
  return new Promise((resolve, reject) => {
    let paper = wx.getStorageSync('paper');
    _this.setData({
      paper: paper,
      loading: false,
    });
    wx.createSelectorQuery().select('#main').boundingClientRect(function (rect) {
      // 容器的宽高是图片的最大宽高
      let max_width = rect.width,
        max_height = rect.height;

      let paper = _this.data.paper,
        // paper宽高比
        paper_whscale = paper.width / paper.height,
        // 纸张和显示尺寸比
        show_paper_scale = 1;
      if (paper.width > paper.height) {
        show_paper_scale = max_width / paper.width;
        // 横向排版
        _this.setData({
          frame_width: max_width,
          frame_height: max_width / paper_whscale,
          frame_x: 0,
          frame_y: (max_height - max_width / paper_whscale) / 2,
        });
      } else {
        // 竖向排版
        show_paper_scale = max_height / paper.height;
        _this.setData({
          frame_width: max_height * paper_whscale,
          frame_height: max_height,
          frame_x: (max_width - max_height * paper_whscale) / 2,
          frame_y: 0,
        });
      }
      // 设置图片的位置信息和保存初始化位置 x y
      _this.setData({
        pic_width: _this.data.paper.picture.width * show_paper_scale,
        pic_height: _this.data.paper.picture.height * show_paper_scale,
        pic_y: _this.data.paper.picture.y * show_paper_scale,
        pic_x: _this.data.paper.picture.x * show_paper_scale,
        init_pic_x: _this.data.paper.picture.x * show_paper_scale,
        init_pic_y: _this.data.paper.picture.y * show_paper_scale,
      });
      // 添加事件
      resolve();
    }).exec();
  })
}

// 时间戳过期 需要重新登录
const isExpire = () => {
  let expiretime = wx.getStorageSync('expiretime'),
    currentTime = (new Date()).valueOf();
  currentTime = Math.floor(currentTime/1000);
  if (currentTime >= expiretime) {
    // 跳转到登录页面
    wx.reLaunch({
      url: '/pages/login/login'
    })
  }
}

module.exports = {
  api: api,
  debug: debug,
  isExpire: isExpire,
  makePicture: makePicture,
  request: request,
  loginRequest: loginRequest,
  showPaper: showPaper,
  uploadImg: uploadImg,
  makeSpellPic: makeSpellPic,
  makeSpellAlone: makeSpellAlone,
  makeOnePerson: makeOnePerson,
  makeListPerson: makeListPerson,
  makeAvatar: makeAvatar,
  trim: trim,
  makeCart: makeCart,
  makeRotateImg: makeRotateImg,
  ARuploadFile: ARuploadFile,
  getSystemInfo: getSystemInfo
}
