/**
 * v0 AI代码生成集成模块
 * 提供基于v0平台的AI代码生成和优化功能
 */

// 导出核心功能
export {
    generateCodeWithV0,
    optimizeAPIRequest,
    enhanceErrorHandling,
    V0_MODEL_CONFIG
} from './v0Core.js';

/**
 * 使用v0优化现有代码
 * @param {string} code - 需要优化的代码
 * @param {string} requirements - 优化需求
 * @returns {Promise<string>} 优化后的代码
 */
export const optimizeCodeWithV0 = async (code, requirements = '') => {
    const prompt = `请优化以下React代码，使其更加高效、可维护和符合最佳实践：

现有代码：
\`\`\`javascript
${code}
\`\`\`

优化要求：
${requirements || `
- 提高代码可读性
- 优化性能
- 增强错误处理
- 改善组件结构
- 遵循React最佳实践
- 添加TypeScript类型支持
`}

请返回优化后的完整代码。`;

    return generateCodeWithV0(prompt);
};

/**
 * 使用v0生成组件
 * @param {string} componentName - 组件名称
 * @param {string} description - 组件描述
 * @param {Object} props - 组件属性定义
 * @returns {Promise<string>} 生成的组件代码
 */
export const generateComponentWithV0 = async (componentName, description, props = {}) => {
    const propsDefinition = Object.keys(props).length > 0
        ? `\n属性定义：\n${Object.entries(props).map(([key, type]) => `- ${key}: ${type}`).join('\n')}`
        : '';

    const prompt = `创建一个名为 ${componentName} 的React组件。

组件描述：${description}${propsDefinition}

要求：
1. 使用TypeScript
2. 采用函数式组件和Hooks
3. 包含PropTypes或TypeScript接口定义
4. 添加完整的JSDoc文档
5. 使用Tailwind CSS进行样式设计
6. 包含适当的错误边界处理
7. 确保组件的可重用性和可测试性
8. 遵循React最佳实践

请生成完整的组件代码，包括导入语句和导出语句。`;

    return generateCodeWithV0(prompt);
};

/**
 * 使用v0生成工具函数
 * @param {string} functionName - 函数名称
 * @param {string} description - 函数描述
 * @param {Array} parameters - 参数列表
 * @param {string} returnType - 返回类型
 * @returns {Promise<string>} 生成的函数代码
 */
export const generateUtilityWithV0 = async (functionName, description, parameters = [], returnType = 'any') => {
    const parametersDefinition = parameters.length > 0
        ? `\n参数：\n${parameters.map(param => `- ${param.name}: ${param.type} - ${param.description || ''}`).join('\n')}`
        : '';

    const prompt = `创建一个名为 ${functionName} 的工具函数。

函数描述：${description}${parametersDefinition}
返回类型：${returnType}

要求：
1. 使用TypeScript
2. 包含完整的JSDoc文档
3. 添加参数验证
4. 包含错误处理
5. 确保函数的纯性和可测试性
6. 遵循函数式编程原则
7. 添加单元测试示例

请生成完整的函数代码，包括类型定义和文档。`;

    return generateCodeWithV0(prompt);
};

/**
 * 使用v0生成API服务代码
 * @param {string} serviceName - 服务名称
 * @param {string} baseURL - API基础URL
 * @param {Array} endpoints - 端点列表
 * @returns {Promise<string>} 生成的API服务代码
 */
export const generateApiServiceWithV0 = async (serviceName, baseURL, endpoints = []) => {
    const endpointsDefinition = endpoints.length > 0
        ? `\nAPI端点：\n${endpoints.map(endpoint =>
            `- ${endpoint.method} ${endpoint.path} - ${endpoint.description || ''}`
        ).join('\n')}`
        : '';

    const prompt = `创建一个名为 ${serviceName} 的API服务类。

基础URL：${baseURL}${endpointsDefinition}

要求：
1. 使用TypeScript
2. 支持请求/响应拦截器
3. 包含错误处理和重试机制
4. 支持请求超时和取消
5. 添加类型安全的API方法
6. 包含完整的JSDoc文档
7. 支持环境变量配置
8. 遵循RESTful API最佳实践

请生成完整的API服务代码，包括类型定义和使用示例。`;

    return generateCodeWithV0(prompt);
};

/**
 * 使用v0进行代码重构建议
 * @param {string} code - 需要重构的代码
 * @param {string} issues - 发现的问题
 * @returns {Promise<Object>} 重构建议和改进后的代码
 */
export const getRefactoringAdviceFromV0 = async (code, issues = '') => {
    const prompt = `分析以下React代码并提供重构建议：

代码：
\`\`\`javascript
${code}
\`\`\`

${issues ? `已发现的问题：\n${issues}\n` : ''}

请提供：
1. 代码质量评估
2. 具体的重构建议
3. 性能优化建议
4. 最佳实践建议
5. 重构后的代码示例

请以JSON格式返回结果：
{
  "assessment": "代码质量评估",
  "suggestions": ["建议1", "建议2", ...],
  "optimizations": ["优化1", "优化2", ...],
  "refactoredCode": "重构后的代码"
}`;

    try {
        const response = await generateCodeWithV0(prompt);

        // 尝试解析JSON响应
        try {
            return JSON.parse(response);
        } catch (parseError) {
            // 如果解析失败，返回原始文本
            return {
                assessment: "代码分析完成",
                suggestions: [response],
                optimizations: [],
                refactoredCode: code
            };
        }
    } catch (error) {
        console.error('v0重构建议生成失败:', error);
        throw new Error(`v0重构建议生成失败: ${error.message}`);
    }
};

/**
 * 使用v0生成测试代码
 * @param {string} componentCode - 组件代码
 * @param {string} testFramework - 测试框架 (jest, vitest等)
 * @returns {Promise<string>} 生成的测试代码
 */
export const generateTestsWithV0 = async (componentCode, testFramework = 'jest') => {
    const prompt = `为以下React组件生成完整的单元测试：

组件代码：
\`\`\`javascript
${componentCode}
\`\`\`

测试框架：${testFramework}

要求：
1. 使用React Testing Library
2. 包含组件渲染测试
3. 测试用户交互
4. 测试边界情况
5. 测试错误处理
6. 包含快照测试
7. 确保高测试覆盖率
8. 添加详细的测试描述

请生成完整的测试文件代码。`;

    return generateCodeWithV0(prompt);
};

/**
 * v0集成配置验证
 * @returns {boolean} 是否配置正确
 */
export const validateV0Integration = () => {
    try {
        // 检查必要的依赖
        const requiredModules = ['ai', '@ai-sdk/vercel'];

        for (const module of requiredModules) {
            try {
                require.resolve(module);
            } catch (error) {
                console.error(`缺少必要依赖: ${module}`);
                return false;
            }
        }

        return true;
    } catch (error) {
        console.error('v0集成验证失败:', error);
        return false;
    }
};
