/**
 * EchoMemo - Application Logic (Server Version)
 */

class EchoMemo {
    constructor() {
        this.memos = [];
        this.currentMemoId = null;
        this.recognition = null;
        this.isRecording = false;

        // DOM Elements
        this.memoList = document.getElementById('memo-list');
        this.addMemoBtn = document.getElementById('add-memo-btn');
        this.voiceWidgetBtn = document.getElementById('voice-widget-btn');
        this.editModal = document.getElementById('edit-modal');
        this.closeModalBtn = document.getElementById('close-modal-btn');
        this.deleteMemoBtn = document.getElementById('delete-memo-btn');
        this.saveMemoBtn = document.getElementById('save-memo-btn');
        this.micBtn = document.getElementById('mic-btn');
        this.micIcon = document.getElementById('mic-icon');
        this.newlineBtn = document.getElementById('newline-btn');
        this.memoTextarea = document.getElementById('memo-textarea');
        this.tagInput = document.getElementById('tag-input');
        this.recordingStatus = document.getElementById('recording-status');

        this.newlineTimer = null;
        this.isSameLine = false;

        // Sorting state
        this.currentSortMode = 'date'; // 'date' or 'tags'
        this.sortToggleBtn = document.getElementById('sort-toggle-btn');
        this.sortLabel = document.getElementById('sort-label');

        this.init();
    }

    async init() {
        await this.fetchMemos();
        this.setupEventListeners();
        this.setupSpeechRecognition();
        this.handleUrlActions();
    }

    async fetchMemos() {
        try {
            const response = await fetch('/api/memos');
            if (!response.ok) throw new Error('Fetch failed');
            this.memos = await response.json();
            this.renderMemoList();
        } catch (err) {
            console.error('Error fetching memos:', err);
            // Fallback to empty if server not ready
            this.memos = [];
            this.renderMemoList();
        }
    }

    updateRecordingStatus(message) {
        if (this.recordingStatus) {
            this.recordingStatus.textContent = message;
        }
    }

    handleUrlActions() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'voice') {
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
        this.deleteMemoBtn.addEventListener('click', () => this.deleteMemo());
        this.micBtn.addEventListener('click', () => this.toggleRecording());
        this.newlineBtn.addEventListener('click', () => this.forceNewline());

        this.editModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal());

        this.sortToggleBtn.addEventListener('click', () => this.toggleSortMode());
    }

    toggleSortMode() {
        this.currentSortMode = this.currentSortMode === 'date' ? 'tags' : 'date';
        this.sortLabel.textContent = this.currentSortMode === 'date' ? '日付順' : 'タグ別';
        this.renderMemoList();
    }

    forceNewline() {
        let currentText = this.memoTextarea.value;
        const linePrefix = '　';
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
        }, 10000);
    }

    startVoiceWidget() {
        this.openModal();
        this.startRecording();
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('Speech Recognition not supported.');
            this.updateRecordingStatus('音声認識非対応のブラウザです');
            this.micBtn.disabled = true;
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = true;
        this.recognition.interimResults = true; // リアルタイム表示を有効化

        this.recognition.onstart = () => {
            this.updateRecordingStatus('● お話しください');
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
            // セッション開始時のテキストを保持
            this.baseTextBeforeInterim = this.memoTextarea.value;
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                this.appendFormattedText(finalTranscript);
                this.baseTextBeforeInterim = this.memoTextarea.value;
            } else if (interimTranscript) {
                // 確定前の言葉を末尾に一時表示
                const displayInterim = interimTranscript.replace(/^[・　 ]+/, '');
                this.memoTextarea.value = this.baseTextBeforeInterim + (this.isSameLine ? ' ' : '　') + displayInterim;
                this.memoTextarea.scrollTop = this.memoTextarea.scrollHeight;
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.stopRecording();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
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
            // ステータスを「準備中」にする（マイクはまだ生きていない）
            this.updateRecordingStatus('マイク起動中...');
            this.micBtn.classList.add('recording');
            this.isRecording = true;

            this.recognition.start();

            // 実際の開始検知は setupSpeechRecognition 内の onstart で行う
        } catch (e) {
            console.error('Failed to start recognition:', e);
            this.isRecording = false;
            this.micBtn.classList.remove('recording');
            this.updateRecordingStatus('エラーが発生しました');
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
        const linePrefix = '　';

        if (currentText.length === 0) {
            currentText = linePrefix;
        } else if (!this.isSameLine) {
            if (!currentText.endsWith('\n')) {
                currentText += '\n';
            }
            currentText += linePrefix;
        } else {
            if (currentText.length > 0 && !currentText.endsWith('\n') && !currentText.endsWith('　') && !currentText.endsWith(' ')) {
                currentText += ' ';
            }
        }

        const cleanedText = text.replace(/^[・　 ]+/, '');
        this.memoTextarea.value = currentText + cleanedText;
        this.isSameLine = true;
        this.resetNewlineTimer();
        this.memoTextarea.scrollTop = this.memoTextarea.scrollHeight;
    }

    openModal(memoId = null) {
        this.currentMemoId = memoId;
        this.isSameLine = false;

        if (memoId) {
            const memo = this.memos.find(m => m.id == memoId);
            this.memoTextarea.value = memo.content;
            this.tagInput.value = (memo.tags || []).join(', ');
            this.deleteMemoBtn.classList.remove('hidden');
        } else {
            this.memoTextarea.value = '';
            this.tagInput.value = '';
            this.deleteMemoBtn.classList.add('hidden');
        }

        this.editModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.stopRecording();
        if (this.newlineTimer) clearTimeout(this.newlineTimer);
        this.editModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    async saveMemo() {
        const content = this.memoTextarea.value.trim();
        if (!content) {
            this.closeModal();
            return;
        }

        const lines = content.split('\n');
        const firstLine = lines[0].trim().replace(/^　/, '');
        const title = firstLine || '無題のメモ';

        // Tags parsing
        const tags = this.tagInput.value
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const memoData = { title, content, tags };

        try {
            let response;
            if (this.currentMemoId) {
                // Update
                response = await fetch(`/api/memos/${this.currentMemoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memoData)
                });
            } else {
                // Create
                response = await fetch('/api/memos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memoData)
                });
            }

            if (response.ok) {
                await this.fetchMemos();
                this.closeModal();
            } else {
                alert('保存に失敗しました。');
            }
        } catch (err) {
            console.error('Error saving memo:', err);
            alert('サーバーとの通信に失敗しました。');
        }
    }

    async deleteMemo() {
        if (!this.currentMemoId) return;
        if (!confirm('このメモを削除してもよろしいですか？')) return;

        try {
            const response = await fetch(`/api/memos/${this.currentMemoId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.fetchMemos();
                this.closeModal();
            } else {
                alert('削除に失敗しました。');
            }
        } catch (err) {
            console.error('Error deleting memo:', err);
            alert('サーバーとの通信に失敗しました。');
        }
    }

    renderMemoList() {
        this.memoList.innerHTML = '';

        if (this.memos.length === 0) {
            this.memoList.innerHTML = `
                <div style="text-align: center; margin-top: 50px; color: var(--text-secondary);">
                    <p>メモがありません。<br>右下のボタンから作成してください。</p>
                </div>
            `;
            return;
        }

        if (this.currentSortMode === 'date') {
            // Sort by updatedAt descending
            const sortedMemos = [...this.memos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            sortedMemos.forEach(memo => this.renderMemoCard(memo, this.memoList));
        } else {
            // Group by tags
            const groups = {};
            this.memos.forEach(memo => {
                const tags = memo.tags && memo.tags.length > 0 ? memo.tags : ['未分類'];
                tags.forEach(tag => {
                    if (!groups[tag]) groups[tag] = [];
                    groups[tag].push(memo);
                });
            });

            // Sort tag names alphabetically, but keep "未分類" at bottom
            const tagNames = Object.keys(groups).sort((a, b) => {
                if (a === '未分類') return 1;
                if (b === '未分類') return -1;
                return a.localeCompare(b, 'ja');
            });

            tagNames.forEach(tagName => {
                const header = document.createElement('div');
                header.className = 'group-header';
                header.textContent = tagName;
                this.memoList.appendChild(header);

                const groupMemos = groups[tagName].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                groupMemos.forEach(memo => this.renderMemoCard(memo, this.memoList));
            });
        }
    }

    renderMemoCard(memo, container) {
        const date = new Date(memo.updated_at);
        const dateString = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

        const card = document.createElement('div');
        card.className = 'memo-card';

        let tagsHtml = '';
        if (memo.tags && memo.tags.length > 0) {
            tagsHtml = `<div class="tag-container">
                ${memo.tags.map(t => `<span class="tag-badge">${this.escapeHtml(t)}</span>`).join('')}
            </div>`;
        }

        card.innerHTML = `
            <div class="title">${this.escapeHtml(memo.title)}</div>
            <div class="date">${dateString}</div>
            ${tagsHtml}
        `;
        card.addEventListener('click', () => this.openModal(memo.id));
        container.appendChild(card);
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new EchoMemo();
});
