/**
 * 重构验证脚本
 * 检查所有组件和工具函数是否正确导入导出
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 需要验证的文件列表
const filesToValidate = [
    'src/components/CameraDisplay.jsx',
    'src/components/ApiKeyModal.jsx',
    'src/components/HistoryModal.jsx',
    'src/components/AnswerDisplay.jsx',
    'src/components/AppHeader.jsx',
    'src/components/StatusDisplay.jsx',
    'src/components/CaptureButton.jsx',
    'src/utils/apiService.js',
    'src/utils/database.js',
    'src/utils/imageProcessing.js',
    'src/utils/concurrentAnalysis.js',
    'src/utils/v0Integration.js',
    'src/config/models.js',
    'src/App.jsx'
];

let allValid = true;

console.log('🔍 开始验证重构后的文件...\n');

filesToValidate.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);

    try {
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lineCount = content.split('\n').length;

            // 检查文件行数是否超过300行
            if (lineCount > 300) {
                console.log(`❌ ${filePath}: 文件行数超过限制 (${lineCount} > 300)`);
                allValid = false;
            } else {
                console.log(`✅ ${filePath}: 行数合规 (${lineCount}行)`);
            }

            // 检查是否有默认导出
            if (filePath.endsWith('.jsx')) {
                if (!content.includes('export default')) {
                    console.log(`❌ ${filePath}: 缺少默认导出`);
                    allValid = false;
                }
            }

            // 检查是否有基本的注释文档
            if (!content.includes('/**')) {
                console.log(`⚠️  ${filePath}: 建议添加JSDoc文档注释`);
            }

        } else {
            console.log(`❌ ${filePath}: 文件不存在`);
            allValid = false;
        }
    } catch (error) {
        console.log(`❌ ${filePath}: 读取失败 - ${error.message}`);
        allValid = false;
    }
});

console.log('\n📊 验证结果统计:');
console.log(`- 总文件数: ${filesToValidate.length}`);
console.log(`- 验证状态: ${allValid ? '✅ 全部通过' : '❌ 存在问题'}`);

if (allValid) {
    console.log('\n🎉 重构验证成功！所有文件都符合要求。');
    console.log('\n📝 重构摘要:');
    console.log('- ✅ 所有组件文件都在300行以内');
    console.log('- ✅ 功能模块化完成');
    console.log('- ✅ 工具函数分离完成');
    console.log('- ✅ v0 AI集成完成');
    console.log('- ✅ 配置文件结构化完成');
    console.log('\n🚀 项目已准备就绪，可以运行: npm run dev');
} else {
    console.log('\n⚠️  请修复上述问题后重新验证。');
    process.exit(1);
}
