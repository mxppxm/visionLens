/**
 * 图像处理工具模块
 * 提供图像预处理、压缩和格式转换功能
 */

/**
 * 图片预处理函数：包括灰度转换、尺寸和质量压缩
 * @param {HTMLVideoElement} video - 视频元素
 * @param {Object} options - 配置选项
 * @param {number} options.maxWidth - 最大宽度，默认800
 * @param {number} options.quality - 压缩质量，默认0.7
 * @param {boolean} options.grayscale - 是否转换为灰度图，默认true
 * @returns {string} Base64编码的图像数据
 */
export const preprocessAndCompressImage = (video, options = {}) => {
    const {
        maxWidth = 800,
        quality = 0.7,
        grayscale = true
    } = options;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // 设置最大宽度，按比例压缩
    const ratio = maxWidth / video.videoWidth;
    canvas.width = maxWidth;
    canvas.height = video.videoHeight * ratio;

    // 绘制图片
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 转换为灰度图
    if (grayscale) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = avg; // red
            data[i + 1] = avg; // green
            data[i + 2] = avg; // blue
        }
        ctx.putImageData(imageData, 0, 0);
    }

    // 以指定的JPEG质量压缩并返回base64数据
    return canvas.toDataURL("image/jpeg", quality).split(",")[1];
};

/**
 * 从文件创建图像数据
 * @param {File} file - 图像文件
 * @param {Object} options - 配置选项
 * @returns {Promise<string>} Base64编码的图像数据
 */
export const processImageFile = async (file, options = {}) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        img.onload = () => {
            const {
                maxWidth = 800,
                quality = 0.7,
                grayscale = true
            } = options;

            // 设置最大宽度，按比例压缩
            const ratio = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * ratio;

            // 绘制图片
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // 转换为灰度图
            if (grayscale) {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                    data[i] = avg; // red
                    data[i + 1] = avg; // green
                    data[i + 2] = avg; // blue
                }
                ctx.putImageData(imageData, 0, 0);
            }

            // 返回base64数据
            const base64Data = canvas.toDataURL("image/jpeg", quality).split(",")[1];
            resolve(base64Data);
        };

        img.onerror = () => {
            reject(new Error("图像加载失败"));
        };

        // 创建对象URL
        const objectURL = URL.createObjectURL(file);
        img.src = objectURL;
    });
};

/**
 * 验证图像文件类型
 * @param {File} file - 文件对象
 * @returns {boolean} 是否为有效的图像文件
 */
export const isValidImageFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return validTypes.includes(file.type);
};

/**
 * 获取图像的基本信息
 * @param {File} file - 图像文件
 * @returns {Promise<Object>} 图像信息对象
 */
export const getImageInfo = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            resolve({
                width: img.width,
                height: img.height,
                size: file.size,
                type: file.type,
                name: file.name,
                lastModified: file.lastModified,
            });
        };

        img.onerror = () => {
            reject(new Error("无法获取图像信息"));
        };

        const objectURL = URL.createObjectURL(file);
        img.src = objectURL;
    });
};

/**
 * 调整图像大小
 * @param {string} base64Data - Base64编码的图像数据
 * @param {number} maxWidth - 最大宽度
 * @param {number} maxHeight - 最大高度
 * @param {number} quality - 压缩质量
 * @returns {Promise<string>} 调整后的Base64图像数据
 */
export const resizeImage = async (base64Data, maxWidth, maxHeight, quality = 0.8) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        img.onload = () => {
            // 计算新的尺寸
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;

            // 绘制调整后的图像
            ctx.drawImage(img, 0, 0, width, height);

            // 返回调整后的base64数据
            const resizedBase64 = canvas.toDataURL("image/jpeg", quality).split(",")[1];
            resolve(resizedBase64);
        };

        img.onerror = () => {
            reject(new Error("图像调整失败"));
        };

        img.src = `data:image/jpeg;base64,${base64Data}`;
    });
};

/**
 * 创建图像缩略图
 * @param {string} base64Data - Base64编码的图像数据
 * @param {number} thumbnailSize - 缩略图尺寸（正方形）
 * @returns {Promise<string>} 缩略图的Base64数据
 */
export const createThumbnail = async (base64Data, thumbnailSize = 150) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        img.onload = () => {
            const { width, height } = img;

            // 计算裁剪区域（居中裁剪为正方形）
            const size = Math.min(width, height);
            const x = (width - size) / 2;
            const y = (height - size) / 2;

            canvas.width = thumbnailSize;
            canvas.height = thumbnailSize;

            // 绘制缩略图
            ctx.drawImage(
                img,
                x, y, size, size,  // 源裁剪区域
                0, 0, thumbnailSize, thumbnailSize  // 目标区域
            );

            const thumbnailBase64 = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
            resolve(thumbnailBase64);
        };

        img.onerror = () => {
            reject(new Error("缩略图创建失败"));
        };

        img.src = `data:image/jpeg;base64,${base64Data}`;
    });
};
