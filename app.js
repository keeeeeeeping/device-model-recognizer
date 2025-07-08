const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const snap = document.getElementById('snap');
const context = canvas.getContext('2d');
const resultDiv = document.getElementById('result');
const statusDiv = document.getElementById('status');

// 定义设备型号与完整URL的精确映射关系
// 这里的键是OCR可能识别到的设备型号（子序列），值是跳转的完整URL
const deviceModelToFullUrlMap = {
    'SPD3303X-E': 'https://vr.douhuiai.com/v/954703e9k7a998-1751007178.html', // 示例URL，请替换为您的实际URL

    // 请在此处添加更多您的设备型号及其对应的完整URL
};

// 存储 Tesseract Worker 实例
let worker;

// 初始化摄像头
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); // 优先使用后置摄像头
        video.srcObject = stream;
        statusDiv.textContent = '摄像头已启动，请对准设备型号。';
    } catch (err) {
        console.error('无法访问摄像头:', err);
        statusDiv.textContent = '无法访问摄像头，请检查权限。';
    }
}

// 初始化 Tesseract.js Worker
async function initializeTesseract() {
    statusDiv.textContent = '正在加载OCR引擎...';
    try {
        worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    statusDiv.textContent = `识别中: ${Math.round(m.progress * 100)}%`;
                } else if (m.status === 'loading tesseract core') {
                    statusDiv.textContent = `加载核心: ${Math.round(m.progress * 100)}%`;
                } else if (m.status === 'initializing tesseract') {
                    statusDiv.textContent = `初始化: ${Math.round(m.progress * 100)}%`;
                } else if (m.status === 'loading language traineddata') {
                    statusDiv.textContent = `加载语言数据: ${Math.round(m.progress * 100)}%`;
                }
            }
        });

        // 设置 OCR 参数，例如只识别数字和字母
        await worker.recoqnize('', {
            tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_. /'
        });

        statusDiv.textContent = 'OCR引擎加载完成。';
        console.log('Tesseract Worker initialized.');
    } catch (error) {
        console.error('Tesseract Worker 初始化失败:', error);
        statusDiv.textContent = 'OCR引擎加载失败，请检查网络连接。';
    }
}

// 拍照并进行 OCR 识别
snap.addEventListener('click', async () => {
    if (!worker) {
        statusDiv.textContent = 'OCR引擎尚未加载，请稍候...';
        return;
    }

    // 设置 canvas 尺寸与视频流一致
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 显示 canvas 隐藏 video
    video.style.display = 'none';
    canvas.style.display = 'block';
    snap.disabled = true; // 识别过程中禁用按钮
    statusDiv.textContent = '正在识别文字...';
    resultDiv.textContent = '';

    try {
        const { data: { text } } = await worker.recognize(canvas);
        console.log('识别结果:', text);

        const matchedModelInfo = findMatchedModelAndUrl(text); // 调用新函数查找匹配的型号和对应的URL

        if (matchedModelInfo) { // 如果找到了匹配的型号和URL
            resultDiv.textContent = `识别到型号：${matchedModelInfo.model}`;
            const redirectUrl = matchedModelInfo.fullUrl; // 使用匹配到的完整URL
            statusDiv.textContent = `识别完成，即将跳转到：${redirectUrl}`;
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 2000); // 延迟2秒跳转，让用户看到结果
        } else {
            statusDiv.textContent = '未识别到有效的设备型号，请尝试重新拍照。';
            resultDiv.textContent = `识别到的文本（未匹配）：${text || '无'}`; // 显示原始识别文本供调试
            snap.disabled = false; // 重新启用按钮
            video.style.display = 'block'; // 重新显示视频
            canvas.style.display = 'none'; // 隐藏canvas
        }

    } catch (error) {
        console.error('OCR识别失败:', error);
        statusDiv.textContent = '识别失败，请重试。';
        snap.disabled = false; // 重新启用按钮
        video.style.display = 'block';
        canvas.style.display = 'none';
    }
});

// 查找OCR结果中是否包含预设的设备型号，并返回对应的型号和完整URL
function findMatchedModelAndUrl(ocrText) {
    // 对OCR文本进行预处理，例如转换为大写并移除所有空格，以提高匹配的鲁棒性
    const cleanedOcrText = ocrText.replace(/\s+/g, '').toUpperCase();

    // 遍历 deviceModelToFullUrlMap 中的所有预设型号
    // 注意：Object.keys() 返回的是对象的键（即设备型号字符串）
    for (const model of Object.keys(deviceModelToFullUrlMap)) {
        // 将预设型号也转换为大写，并移除空格（如果型号本身包含空格的话）
        const cleanedModel = model.replace(/\s+/g, '').toUpperCase();

        // 检查清理后的OCR文本是否包含清理后的预设型号作为子序列
        if (cleanedOcrText.includes(cleanedModel)) {
            return {
                model: model, // 返回原始的设备型号字符串
                fullUrl: deviceModelToFullUrlMap[model] // 返回对应的完整URL
            };
        }
    }
    return null; // 如果没有找到任何匹配的型号，则返回null
}

// 页面加载时执行
window.onload = async () => {
    await initCamera();
    await initializeTesseract();
};