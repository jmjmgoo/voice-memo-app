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
        this.tagSuggestions = document.getElementById('tag-suggestions');
        this.recordingStatus = document.getElementById('recording-status');

        this.newlineTimer = null;
        this.isSameLine = false;

        this.currentSortMode = 'date';
        this.sortToggleBtn = document.getElementById('sort-toggle-btn');
        this.sortLabel = document.getElementById('sort-label');

        this.init();
    }

    async init() {
        this.setupSpeechRecognition();
        await this.fetchMemos();
        this.setupEventListeners();
        this.handleUrlActions();
    }

    async fetchMemos() {
        try {
            const response = await fetch('/api/memos');
            if (!response.ok) throw new Error('Fetch failed');
            this.memos = await response.json();
            this.renderMemoList();
            this.updateTagSuggestions();
        } catch (err) {
            console.error('Error fetching memos:', err);
            this.memos = [];
            this.renderMemoList();
        }
    }

    updateTagSuggestions() {
        const allTags = new Set();
        this.memos.forEach(m => {
            if (m.tags) m.tags.forEach(t => allTags.add(t));
        });

        this.tagSuggestions.innerHTML = '';
        Array.from(allTags).sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            this.tagSuggestions.appendChild(option);
        });
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
        this.openModal(null, true);
    }

    setupSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech recognition not supported in this browser.');
            this.updateRecordingStatus('音声認識に対応していません');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.interimResults = true;
        this.recognition.continuous = true;

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.micBtn.classList.add('recording');
            this.updateRecordingStatus('音声入力中...');
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.micBtn.classList.remove('recording');
            this.updateRecordingStatus('音声入力を停止しました');
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isRecording = false;
            this.micBtn.classList.remove('recording');
            if (event.error === 'not-allowed') {
                this.updateRecordingStatus('マイクの使用が許可されていません');
            } else {
                this.updateRecordingStatus('音声認識エラー: ' + event.error);
            }
        };

        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                this.appendFormattedText(finalTranscript);
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
        if (!this.recognition) {
            this.memoTextarea.focus();
            return;
        }
        try {
            this.recognition.start();
            this.memoTextarea.focus();
        } catch (err) {
            console.error('Recognition start error:', err);
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
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

    openModal(memoId = null, startVoice = false) {
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
        this.updateTagSuggestions();
        document.body.style.overflow = 'hidden';

        // Automatically focus for native voice input
        setTimeout(() => {
            this.memoTextarea.focus();
        }, 300);
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

        const tags = this.tagInput.value
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        const memoData = { title, content, tags };

        try {
            let response;
            if (this.currentMemoId) {
                response = await fetch(`/api/memos/${this.currentMemoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(memoData)
                });
            } else {
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
            const sortedMemos = [...this.memos].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
            sortedMemos.forEach(memo => this.renderMemoCard(memo, this.memoList));
        } else {
            const groups = {};
            this.memos.forEach(memo => {
                const tags = memo.tags && memo.tags.length > 0 ? memo.tags : ['未分類'];
                tags.forEach(tag => {
                    if (!groups[tag]) groups[tag] = [];
                    groups[tag].push(memo);
                });
            });

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
