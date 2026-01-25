/**
 * EchoMemo - Application Logic (Server Version)
 */

class EchoMemo {
    constructor() {
        this.memos = [];
        this.currentMemoId = null;
        this.recognition = null;
        this.isRecording = false;

        // Internal content state to prevent duplication bugs
        this.confirmedContent = '';

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

        // Sync confirmedContent when user types manually
        this.memoTextarea.addEventListener('input', () => {
            this.confirmedContent = this.memoTextarea.value;
        });
    }

    toggleSortMode() {
        this.currentSortMode = this.currentSortMode === 'date' ? 'tags' : 'date';
        this.sortLabel.textContent = this.currentSortMode === 'date' ? '日付順' : 'タグ別';
        this.renderMemoList();
    }

    forceNewline() {
        const linePrefix = '　';
        if (this.confirmedContent.length > 0) {
            if (!this.confirmedContent.endsWith('\n')) {
                this.confirmedContent += '\n';
            }
            this.confirmedContent += linePrefix;
        } else {
            this.confirmedContent = linePrefix;
        }
        this.memoTextarea.value = this.confirmedContent;
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
        this.recognition.interimResults = true;

        this.recognition.onstart = () => {
            this.updateRecordingStatus('● お話しください');
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
            }
            // Capture the state at the start of recognition
            this.confirmedContent = this.memoTextarea.value;
        };

        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscriptOnEvent = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscriptOnEvent += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscriptOnEvent) {
                this.appendFormattedText(finalTranscriptOnEvent);
            }

            // Always display confirmed part + currently guessed part
            const interimPart = interimTranscript ? (this.isSameLine ? ' ' : '　') + interimTranscript.replace(/^[・　 ]+/, '') : '';
            this.memoTextarea.value = this.confirmedContent + interimPart;
            this.memoTextarea.scrollTop = this.memoTextarea.scrollHeight;
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
            this.updateRecordingStatus('マイク起動中...');
            this.micBtn.classList.add('recording');
            this.isRecording = true;
            this.recognition.start();
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
        const linePrefix = '　';
        let processedText = text.replace(/^[・　 ]+/, '');

        if (this.confirmedContent.length === 0) {
            this.confirmedContent = linePrefix;
        } else if (!this.isSameLine) {
            if (!this.confirmedContent.endsWith('\n')) {
                this.confirmedContent += '\n';
            }
            this.confirmedContent += linePrefix;
        } else {
            if (!this.confirmedContent.endsWith('\n') && !this.confirmedContent.endsWith('　') && !this.confirmedContent.endsWith(' ')) {
                this.confirmedContent += ' ';
            }
        }

        this.confirmedContent += processedText;
        this.isSameLine = true;
        this.resetNewlineTimer();
    }

    openModal(memoId = null) {
        this.currentMemoId = memoId;
        this.isSameLine = false;

        if (memoId) {
            const memo = this.memos.find(m => m.id == memoId);
            this.confirmedContent = memo.content;
            this.tagInput.value = (memo.tags || []).join(', ');
            this.deleteMemoBtn.classList.remove('hidden');
        } else {
            this.confirmedContent = '';
            this.tagInput.value = '';
            this.deleteMemoBtn.classList.add('hidden');
        }

        this.memoTextarea.value = this.confirmedContent;
        this.editModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';

        // Refresh suggestions for this open
        this.updateTagSuggestions();
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
