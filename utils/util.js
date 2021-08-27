// 根据设备Id拿到随机数解密密钥
function getAESKeyFromDeiviceId(deviceBleId) {
  const idArray = str2Bytes(deviceBleId).reverse(); // 按照文档截取成数组，且是反序
  const AESKey = []
  AESKey[0] = idArray[0];
  AESKey[1] = idArray[1];
  AESKey[2] = idArray[2];
  AESKey[3] = idArray[3];
  AESKey[4] = idArray[4];
  AESKey[5] = idArray[5];
  AESKey[6] = idArray[0] + idArray[1];
  AESKey[7] = idArray[1] + idArray[2];
  AESKey[8] = idArray[2] + idArray[3];
  AESKey[9] = idArray[3] + idArray[4];
  AESKey[10] = idArray[4] + idArray[5];
  AESKey[11] = idArray[0] - idArray[1];
  AESKey[12] = idArray[1] - idArray[2];
  AESKey[13] = idArray[2] - idArray[3];
  AESKey[14] = idArray[3] - idArray[4];
  AESKey[15] = idArray[4] - idArray[5];
  return AESKey
}

// 随机16位数据
function getRandom16() {
  var dataArray = []
  for (let i = 0; i < 16; i++) {
    dataArray.push(Math.random() * 255 | 0)
  }
  return bytes2Str(dataArray)
}

// 数组中是否存在
function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}

// 字符串转16进制数组
function str2Bytes(str) {
  var pos = 0;
  var len = str.length;
  if (len % 2 != 0) {
    return null;
  }
  len /= 2;
  var hexA = new Array();
  for (var i = 0; i < len; i++) {
    var s = str.substr(pos, 2);
    var v = parseInt(s, 16);
    if (v >= 127) v = v - 255 - 1
    hexA.push(v);
    pos += 2;
  }
  return hexA;
}

// 字节数组转十六进制字符串
function bytes2Str(arr) {
  var str = "";
  for (var i = 0; i < arr.length; i++) {
    var tmp;
    var num = arr[i];
    if (num < 0) {
      //此处填坑，当byte因为符合位导致数值为负时候，需要对数据进行处理
      tmp = (255 + num + 1).toString(16);
    } else {
      tmp = num.toString(16);
    }
    if (tmp.length == 1) {
      tmp = "0" + tmp;
    }
    str += tmp;
  }
  return str;
}

// ArrayBuffer转16进度字符串
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
    }
  )
  return hexArr.join('');
}

// 16进制字符串转ArrayBuffer
function hex2ab(hex) {
  var view = new Uint8Array(hex.length / 2)
  for (var i = 0; i < hex.length; i += 2) {
    view[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return view.buffer
}

module.exports = {
  getAESKeyFromDeiviceId,
  getRandom16,
  inArray,
  str2Bytes,
  bytes2Str,
  ab2hex,
  hex2ab
}