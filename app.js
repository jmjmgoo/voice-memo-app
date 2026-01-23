/**
 * EchoMemo - Application Logic
 */

class EchoMemo {
    constructor() {
        this.memos = JSON.parse(localStorage.getItem('echomemo_data')) || [];
        this.currentMemoId = null;
        this.recognition = null;
        this.isRecording = false;

        // DOM Elements
        this.memoList = document.getElementById('memo-list');
        this.addMemoBtn = document.getElementById('add-memo-btn');
        this.voiceWidgetBtn = document.getElementById('voice-widget-btn');
        this.editModal = document.getElementById('edit-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.saveMemoBtn = document.getElementById('save-memo-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.micIcon = document.getElementById('mic-icon');
        this.newlineBtn = document.getElementById('newline-btn');
        this.memoTextarea = document.getElementById('memo-textarea');
        this.recordingStatus = document.getElementById('recording-status');

        this.newlineTimer = null;
        this.isSameLine = false;

        this.init();
    }

    init() {
        this.renderMemoList();
        this.setupEventListeners();
        this.setupSpeechRecognition();
        this.handleUrlActions();
    }

    updateRecordingStatus(message) {
        if (this.recordingStatus) {
            this.recordingStatus.textContent = message;
        }
    }

    handleUrlActions() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'voice') {
            // Delay slightly to ensure everything is ready
            setTimeout(() => {
                this.startVoiceWidget();
            }, 500);
        }
    }

    setupEventListeners() {
        this.addMemoBtn.addEventListener('click', () => this.openModal());
        this.voiceWidgetBtn.addEventListener('click', () => this.startVoiceWidget());
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.saveMemoBtn.addEventListener('click', () => this.saveMemo());
        this.micBtn.addEventListener('click', () => this.toggleRecording());
        this.newlineBtn.addEventListener('click', () => this.forceNewline());

        // Overlay click to close
        this.editModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());
    }

    forceNewline() {
        let currentText = this.memoTextarea.value;
        const linePrefix = '　'; // 全角空白
        if (currentText.length > 0) {
            if (!currentText.endsWith('\n')) {
                currentText += '\n';
            }
            currentText += linePrefix;
            this.memoTextarea.value = currentText;
        } else {
            this.memoTextarea.value = linePrefix;
        }
        this.resetNewlineTimer();
        this.isSameLine = true;
    }

    resetNewlineTimer() {
        if (this.newlineTimer) clearTimeout(this.newlineTimer);
        this.newlineTimer = setTimeout(() => {
            this.isSameLine = false;
        }, 10000); // 10 seconds
    }

    startVoiceWidget() {
        this.openModal();
        this.startRecording();
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported in this browser.');
            this.updateRecordingStatus('音声認識非対応のブラウザです');
            this.micBtn.disabled = true;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = true;
        this.recognition.interimResults = false;

        this.recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            if (transcript) {
                this.appendFormattedText(transcript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stopRecording();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                // If it ended unexpectedly while we should be recording, restart it
                this.recognition.start();
            }
        };
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!this.recognition) return;

        try {
            this.recognition.start();
            this.isRecording = true;
            this.micBtn.classList.add('recording');
            this.updateRecordingStatus('聞き取り中...');
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    }

    stopRecording() {
        if (!this.recognition) return;

        this.recognition.stop();
        this.isRecording = false;
        this.micBtn.classList.remove('recording');
        this.updateRecordingStatus('タップして話す');
    }

    appendFormattedText(text) {
        let currentText = this.memoTextarea.value;
        const linePrefix = '　'; // 行頭の全角空白

        // Case 1: まったくの初期状態
        if (currentText.length === 0) {
            currentText = linePrefix;
        }
        // Case 2: 改行が必要なタイミング（10秒経過後、または改行ボタン押下後）
        else if (!this.isSameLine) {
            if (!currentText.endsWith('\n')) {
                currentText += '\n';
            }
            currentText += linePrefix;
        }
        // Case 3: 同じ行内での追記
        else {
            // 単語間にスペースが入っていない場合のみ半角スペースを追加（必要に応じて）
            if (!currentText.endsWith('\n') && !currentText.endsWith('　') && !currentText.endsWith(' ')) {
                currentText += ' ';
            }
        }

        // 音声認識結果の冒頭に含まれがちな不要な記号やスペースを削除
        const cleanedText = text.replace(/^[・　 ]+/, '');

        this.memoTextarea.value = currentText + cleanedText;
        this.isSameLine = true;
        this.resetNewlineTimer();

        // テキストエリアを最下部へスクロール
        this.memoTextarea.scrollTop = this.memoTextarea.scrollHeight;
    }

    openModal(memoId = null) {
        this.currentMemoId = memoId;
        this.isSameLine = false; // Reset line status
        if (memoId) {
            const memo = this.memos.find(m => m.id === memoId);
            this.memoTextarea.value = memo.content;
        } else {
            this.memoTextarea.value = '';
        }

        this.editModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent scrolling background
    }

    closeModal() {
        this.stopRecording();
        if (this.newlineTimer) clearTimeout(this.newlineTimer);
        this.editModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    saveMemo() {
        const content = this.memoTextarea.value.trim();
        if (!content) {
            this.closeModal();
            return;
        }

        // The first line is the title
        const lines = content.split('\n');
        const firstLine = lines[0].trim();
        const title = firstLine || '無題のメモ';

        if (this.currentMemoId) {
            // Update existing
            const index = this.memos.findIndex(m => m.id === this.currentMemoId);
            if (index !== -1) {
                this.memos[index] = {
                    ...this.memos[index],
                    title,
                    content,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            // Create new
            const newMemo = {
                id: Date.now().toString(),
                title,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.memos.unshift(newMemo);
        }

        this.saveToLocaleStorage();
        this.renderMemoList();
        this.closeModal();
    }

    saveToLocaleStorage() {
        localStorage.setItem('echomemo_data', JSON.stringify(this.memos));
    }

    renderMemoList() {
        // Sort by updatedAt descending
        this.memos.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        this.memoList.innerHTML = '';

        if (this.memos.length === 0) {
            this.memoList.innerHTML = `
                <div style="text-align: center; margin-top: 50px; color: var(--text-secondary);">
                    <p>メモがありません。<br>右下のボタンから作成してください。</p>
                </div>
            `;
            return;
        }

        this.memos.forEach(memo => {
            const date = new Date(memo.updatedAt);
            const dateString = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

            const card = document.createElement('div');
            card.className = 'memo-card';
            card.innerHTML = `
                <div class="title">${this.escapeHtml(memo.title)}</div>
                <div class="date">${dateString}</div>
            `;
            card.addEventListener('click', () => this.openModal(memo.id));
            this.memoList.appendChild(card);
        });
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Spark the app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EchoMemo();
});
