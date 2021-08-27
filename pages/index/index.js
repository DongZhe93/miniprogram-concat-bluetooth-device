// index.js
// 获取应用实例
import {
  getAESKeyFromDeiviceId,
  getRandom16,
  inArray,
  str2Bytes,
  ab2hex,
  hex2ab
} from '../../utils/util'
import {
  encryptAesCbc,
  decryptAesCbc,
} from '../../utils/aes'
import {
  crc8
} from '../../utils/crc8'

Page({
  data: {
    status: '已就绪...',
    connected: false
  },
  changeStatus(status) {
    this.setData({
      status
    })
  },
  // 调用小程序扫码
  getDeviceIdByScan() {
    if (this.data.connected) {
      this.closeBluetoothAdapter() // 主动断开蓝牙设备连接
    }
    this.scanCodePromise()
      .then(this.handleScanResult)
      .then(this.openBluetoothAdapter)
      .then(this.startBluetoothDevicesDiscovery)
      .then(this.findDevice)
      .then(this.hanleBLEConnection)
      .catch(this.showError)
  },
  hanleBLEConnection() {
    Promise.resolve()
      .then(this.createBLEConnection)
      .then(this.getBLEDeviceServices)
      .then(this.getBLEDeviceCharacteristics)
      .then(this.sendGetRandomValve)
      .catch(this.showError)
  },
  showError(errinfo) {
    wx.showModal({
      content: errinfo,
      showCancel: false
    })
  },
  // 发送获取随机数指令
  sendGetRandomValve(){
    // 监听设备响应
    this.onBLECharacteristicValueChange()
    this.setData({
      connected: true
    })
    this.changeStatus('立即发送随机数')
    // 随机数指令01，迷惑监听者，随机生成16位数据
    const hex = '01' + getRandom16()
    // 立即发送获取随机数指令，设备2s未建立连接将会断开
    this.writeBLECharacteristicValue(hex2ab(hex))
  },
  // 发送开阀指令
  sendOpenValve() {
    this.changeStatus('发送开阀指令...')
    // TODO 设备发送的指令根据设备区分
    let cmdInfo = '1111110011111101010100000000'
    if (this._deviceType === '1') {
      cmdInfo = 'e1' + cmdInfo
    } else {
      cmdInfo = 'f1' + cmdInfo
    }
    // 拼接得到str（前15组数据加最后一组校验位）
    const tempStr = cmdInfo + crc8(str2Bytes(cmdInfo))
    // 加密数据部分
    const sendMsg = '09' + ab2hex(encryptAesCbc(new Uint8Array(str2Bytes(tempStr)).buffer, this._connectAESKey))
    // 模拟透传数据
    this.writeBLECharacteristicValue(hex2ab(sendMsg))
  },
  scanCodePromise() {
    this.changeStatus('开始扫码...')
    return new Promise(resolve => {
      wx.scanCode({
        onlyFromCamera: true,
        success(scanResult) {
          resolve(scanResult)
        }
      })
    })
  },
  handleScanResult(scanResult) {
    this.changeStatus('处理扫码结果...')
    return new Promise((resolve, reject) => {
      const {
        result
      } = scanResult // 扫码得到结果
      const info_array = result.split('_')
      const deviceBleId = info_array[2] // 截取设备ID
      if (deviceBleId && deviceBleId.length === 12) { // 校验二维码格式
        this._deviceType = info_array[0] // 通过第一位区分设备类型
        this._randomAESKey = getAESKeyFromDeiviceId(deviceBleId)
        this._deviceBleId = deviceBleId
        resolve()
      } else {
        reject('无法识别当前设备')
      }
    })
  },
  openBluetoothAdapter() {
    this.changeStatus('初始化蓝牙模块...')
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success(res) {
          resolve()
        },
        fail(res) {
          reject('当前蓝牙适配器不可用，请检查设备蓝牙状态')
        }
      })
    })
  },
  startBluetoothDevicesDiscovery() {
    this.changeStatus('开始搜寻附近的蓝牙外围设备...')
    return new Promise((resolve, reject) => {
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true,
        success() {
          resolve()
        },
        fail(res) {
          reject('搜寻附近蓝牙外围设备出错了')
        }
      })
    })
  },
  findDevice() {
    this.changeStatus('开始查找二维码对应的设备...')
    return new Promise((resolve, reject) => {
      const foundDevices = []
      const startFindTime = Date.now();
      wx.onBluetoothDeviceFound((foundResult) => {
        if(Date.now() - startFindTime > 5000){
          wx.stopBluetoothDevicesDiscovery()
          reject('5秒内未查找到对应的设备')
          this.changeStatus('设备查找失败')
          return
        }
        const {
          devices
        } = foundResult
        devices.forEach(device => {
          // 过滤掉未知设备
          if (!device.name && !device.localName) {
            return
          }
          const idx = inArray(foundDevices, 'deviceId', device.deviceId)
          if (idx === -1) {
            foundDevices[foundDevices.length] = device
          } else {
            foundDevices[idx] = device
          }
        })
        const flag = foundDevices.some(device => {
          if (device.localName && device.localName.includes(this._deviceBleId)) {
            this._deviceId = device.deviceId
            return true
          }
        })
        if (flag) {
          this.changeStatus('找到设备，结束查找设备，释放资源')
          wx.stopBluetoothDevicesDiscovery()
          resolve()
        }
      })
    })
  },
  createBLEConnection() {
    this.changeStatus('建立连接...')
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId: this._deviceId,
        success: () => {
          this.changeStatus('成功与设备建立连接...')
          this.onBLEConnectionStateChange() // 监听蓝牙连接状态
          this.getBLEDeviceServices(this._deviceId)
          resolve()
        },
        fail() {
          reject('连接蓝牙设备失败')
        }
      })
    })
  },
  getBLEDeviceServices() {
    this.changeStatus('查找目标蓝牙设备的服务...')
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId: this._deviceId,
        success: (res) => {
          if (res.services[1]) {
            resolve(res.services[1].uuid)
          } else {
            reject('没找到可用的蓝牙设备服务！！！')
          }
        },
        fail() {
          reject('查找目标蓝牙设备服务出错了')
        }
      })
    })
  },
  getBLEDeviceCharacteristics(serviceId) {
    this.changeStatus('获取蓝牙设备服务中所有特征值...')
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId: this._deviceId,
        serviceId,
        success: (res) => {
          this.changeStatus('蓝牙设备服务中所有特征值获取成功...')
          for (let i = 0; i < res.characteristics.length; i++) {
            let item = res.characteristics[i]
            if (item.properties.write && item.uuid.startsWith('0000FF01')) {
              // 记录写通道的 serviceId、characteristicId
              this._serviceId = serviceId
              this._characteristicId = item.uuid
            } else if (item.properties.notify && item.uuid.startsWith('0000FF04')) {
              wx.notifyBLECharacteristicValueChange({
                deviceId: this._deviceId,
                serviceId,
                characteristicId: item.uuid,
                state: true
              })
            }
            resolve()
          }
        },
        fail() {
          reject('获取蓝牙设备服务中所有特征值失败')
        }
      })
    })
  },
  // 监听蓝牙连接状态，提示重连
  onBLEConnectionStateChange() {
    wx.onBLEConnectionStateChange((res) => {
      if (!res.connected) {
        this.setData({
          connected: false
        })
        wx.showModal({
          content: '是否重连设备？',
          success: (res) => {
            if (res.confirm) {
              this.hanleBLEConnection()
            } else if (res.cancel) {
              this.changeStatus('设备断开连接，尝试重新扫码吧')
            }
          }
        })
      }
    })
  },
  onBLECharacteristicValueChange() {
    wx.onBLECharacteristicValueChange((characteristic) => {
      if (characteristic.characteristicId.startsWith('0000FF04')) {
        const value = ab2hex(characteristic.value)
        // 解析指令
        const commondType = value.slice(0, 2)
        const realContent = value.substr(2)
        // 加密内容转无符号整数数组
        const encrypted = new Uint8Array(str2Bytes(realContent)).buffer
        switch (commondType) {
          case '81': // 随机数响应
            this.changeStatus('接收到随机数响应')
            const key = new Uint8Array(this._randomAESKey).buffer
            this._connectAESKey = decryptAesCbc(encrypted, key)
            // 立即发送一个开阀指令，不发送会被断开 (TODO 可发送其他指令，这里只是为了演示)
            this.sendOpenValve()
            break;
          case '89': // 透传数据响应 （TODO 提取函数，处理不同的指令）
            this.changeStatus('接收到设备响应')
            wx.showToast({
              title: ab2hex(decryptAesCbc(encrypted, this._connectAESKey)),
            })
            break;
          default: // 丢弃
            break;
        }
      }
    })
  },
  writeBLECharacteristicValue(buffer) {
    wx.writeBLECharacteristicValue({
      deviceId: this._deviceId,
      serviceId: this._serviceId,
      characteristicId: this._characteristicId,
      value: buffer,
      success() {
        wx.showToast({
          title: '指令发送成功',
        })
      },
      fail() {
        wx.showToast({
          title: '指令发送失败',
        })
      }
    })
  },
  closeBluetoothAdapter() {
    wx.closeBluetoothAdapter({
      complete: () => {
        this.changeStatus('关闭蓝牙模块')
        this.setData({
          connected: false
        })
      }
    })
  }
})
