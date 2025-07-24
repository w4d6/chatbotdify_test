class DifyChatbot {
    constructor() {
        this.apiKey = 'app-JYpcoHRUulYkDI4OR6j5IXAf';
        this.baseUrl = 'https://api.dify.ai/v1';
        this.conversationId = '';
        this.userId = 'user-' + Date.now();
        
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        
        this.initEventListeners();
    }
    
    initEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }
    
    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;
        
        // ユーザーメッセージを表示
        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.setLoading(true);
        
        try {
            const response = await this.callDifyAPI(message);
            await this.handleStreamResponse(response);
        } catch (error) {
            console.error('Error:', error);
            this.showError('メッセージの送信に失敗しました。もう一度お試しください。');
        } finally {
            this.setLoading(false);
        }
    }
    
    async callDifyAPI(query) {
        const requestBody = {
            inputs: {},
            query: query,
            response_mode: 'streaming',
            conversation_id: this.conversationId,
            user: this.userId,
            files: []
        };
        
        const response = await fetch(`${this.baseUrl}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    }
    
    async handleStreamResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let messageElement = null;
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            switch (data.event) {
                                case 'message':
                                    assistantMessage += data.answer;
                                    if (!messageElement) {
                                        messageElement = this.addMessage('', 'assistant');
                                    }
                                    messageElement.textContent = assistantMessage;
                                    this.scrollToBottom();
                                    break;
                                    
                                case 'message_end':
                                    if (data.conversation_id) {
                                        this.conversationId = data.conversation_id;
                                    }
                                    break;
                                    
                                case 'error':
                                    throw new Error(data.message || 'API Error');
                            }
                        } catch (parseError) {
                            // JSON解析エラーは無視（不完全なデータの可能性）
                            if (line.trim() !== 'data: {"event": "ping"}') {
                                console.warn('Parse error:', parseError);
                            }
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        // メッセージが空の場合のフォールバック
        if (!assistantMessage && messageElement) {
            messageElement.textContent = '申し訳ございませんが、応答を生成できませんでした。';
        }
    }
    
    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.textContent = content;
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }
    
    setLoading(isLoading) {
        this.sendButton.disabled = isLoading;
        this.messageInput.disabled = isLoading;
        
        if (isLoading) {
            this.sendButton.textContent = '送信中...';
            
            // ローディングメッセージを表示
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message assistant loading';
            loadingDiv.innerHTML = '<span class="loading-dots">応答を生成中</span>';
            loadingDiv.id = 'loading-message';
            this.chatMessages.appendChild(loadingDiv);
            this.scrollToBottom();
        } else {
            this.sendButton.textContent = '送信';
            
            // ローディングメッセージを削除
            const loadingMessage = document.getElementById('loading-message');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
    }
    
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        this.chatMessages.appendChild(errorDiv);
        this.scrollToBottom();
        
        // 5秒後にエラーメッセージを削除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
    
    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
}

// チャットボットを初期化
document.addEventListener('DOMContentLoaded', () => {
    new DifyChatbot();
});