const ChatbotUI = {
  conversationHistory: [],

  async init() {
    this.messagesEl = document.getElementById('chat-messages');
    this.inputEl = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('chat-send');
    this.suggestionsEl = document.getElementById('chat-suggestions');
    this.modeIndicator = document.getElementById('chat-mode-indicator');
    this.typingTimer = null;

    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    // AppConfig initialisieren (Backend-Erkennung)
    await AppConfig.init();

    // Begrüßung je nach Modus
    const modeText = AppConfig.mode === 'ollama'
      ? `Hallo! Ich bin der QM-Assistent der Lebenshilfe Braunschweig.\n\n` +
        `Ich bin mit **Ollama (${AppConfig.ollamaModel})** verbunden und kann Ihre Fragen ` +
        `frei formulieren beantworten – basierend auf der internen Wissensdatenbank.\n\n` +
        `**Tipp**: Stellen Sie einfach Ihre Frage zum Prozessmanagement, QM oder BSC!`
      : `Hallo! Ich bin der QM-Assistent der Lebenshilfe Braunschweig.\n\n` +
        `Im **lokalen Modus** durchsuche ich die interne Wissensdatenbank und finde die passenden Antworten.\n\n` +
        `**Tipp**: Für KI-gestützte Antworten starten Sie das Backend (siehe README).`;

    this.addBotMessage(modeText);
    this.updateModeIndicator();
    this.showSuggestions();
    this.initSpeechRecognition();
  },

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const micBtn = document.getElementById('chat-mic');
    if (!micBtn) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.continuous = false;
    recognition.interimResults = true;

    let isListening = false;

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }
      try {
        recognition.start();
      } catch (e) {
        console.warn('SpeechRecognition start failed:', e);
      }
    });

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      micBtn.querySelector('svg').style.stroke = '#fff';
    };

    recognition.onerror = (e) => {
      console.warn('SpeechRecognition error:', e.error);
      isListening = false;
      micBtn.classList.remove('listening');
      if (e.error === 'not-allowed') {
        ChatbotUI.addBotMessage('Mikrofon-Zugriff wurde verweigert. Bitte erlauben Sie den Zugriff in den Browser-Einstellungen.', { sources: [] });
      } else if (e.error === 'no-speech') {
        // silent ignore
      }
    };

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      ChatbotUI.inputEl.value = transcript;
      // Auto-send when final
      if (e.results[e.results.length - 1].isFinal) {
        ChatbotUI.sendMessage();
      }
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
    };
  },

  updateModeIndicator() {
    if (!this.modeIndicator) return;
    if (AppConfig.mode === 'ollama') {
      this.modeIndicator.innerHTML = 'KI (Ollama)';
      this.modeIndicator.style.color = '#00A336';
    } else {
      this.modeIndicator.innerHTML = 'Lokal (NLP)';
      this.modeIndicator.style.color = '#EB6600';
    }
  },

  sendMessage() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.addUserMessage(text);
    this.inputEl.value = '';
    this.showTyping();
    const delay = 500 + Math.random() * 600;
    setTimeout(() => {
      this.hideTyping();
      this.findAndShowAnswer(text);
    }, delay);
  },

  addUserMessage(text) {
    const el = document.createElement('div');
    el.className = 'chat-message user';
    el.innerHTML = `
      <div class="avatar user" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div class="bubble">${this.escapeHtml(text)}</div>
    `;
    this.messagesEl.appendChild(el);
    this.scrollDown();
  },

  addBotMessage(text, extras) {
    const el = document.createElement('div');
    el.className = 'chat-message bot';
    let html = `
      <div class="avatar bot" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div class="bubble">${this.formatMessage(text)}`;
    if (extras) {
      if (extras.sourceUrl) {
        html += `<div class="source-link"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> <a href="${this.escapeHtml(extras.sourceUrl)}" target="_blank" rel="noopener noreferrer">Quelle öffnen</a></div>`;
      }
      if (extras.sources && extras.sources.length) {
        html += `<div class="sources"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> ${this.escapeHtml(extras.sources.join(', '))}</div>`;
      }
    }
    html += `</div>`;

    // Quick-Reply-Vorschläge direkt in die Chat-Nachricht einfügen
    if (extras && extras.suggestions && extras.suggestions.length) {
      html += `<div class="quick-replies">`;
      extras.suggestions.forEach(s => {
        const q = this.escapeHtml(s.question || s);
        html += `<button onclick="ChatbotUI.askQuestion('${q.replace(/'/g, "\\'")}')">${q}</button>`;
      });
      html += `</div>`;
    }

    el.innerHTML = html;
    this.messagesEl.appendChild(el);
    this.scrollDown();
  },

  formatMessage(text) {
    return text.split('\n').map(line => {
      line = this.escapeHtml(line);
      line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return line;
    }).join('<br>');
  },

  showTyping() {
    const el = document.createElement('div');
    el.className = 'typing-indicator';
    el.id = 'typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    this.messagesEl.appendChild(el);
    this.scrollDown();
    // Safety timeout: typing max 15s
    if (this._typingTimer) clearTimeout(this._typingTimer);
    this._typingTimer = setTimeout(() => {
      this.hideTyping();
      if (!this._lastResponseShown) {
        this.addBotMessage('Die Antwortverarbeitung hat zu lange gedauert. Bitte versuchen Sie es erneut.', { sources: [] });
        this._lastResponseShown = true;
      }
    }, 15000);
  },

  hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
    if (this._typingTimer) { clearTimeout(this._typingTimer); this._typingTimer = null; }
  },

  async findAndShowAnswer(query) {
    this._lastResponseShown = false;
    if (!query.trim()) {
      this.hideTyping();
      this.addBotMessage('Bitte geben Sie eine Frage ein.', { sources: [] });
      this.showSuggestions();
      return;
    }
    this.conversationHistory.push({ role: 'user', content: query });

    try {
      let answerText, sourcesList, followUpSuggestions;

      // Mode 2: Ollama-Backend versuchen
      if (AppConfig.mode === 'ollama' && AppConfig.backendUrl) {
        const backendResult = await AppConfig.sendToBackend(query, this.conversationHistory.slice(-6));
        if (backendResult && backendResult.answer) {
          this.conversationHistory.push({ role: 'assistant', content: backendResult.answer });
          answerText = `**KI-Antwort (${backendResult.model || AppConfig.ollamaModel})**\n\n${backendResult.answer}`;
          followUpSuggestions = this.getFollowUpQuestions(null, query);
          this.hideTyping();
          this._lastResponseShown = true;
          this.addBotMessage(answerText, { sources: backendResult.sources || [], suggestions: followUpSuggestions });
          this.showSuggestions(null, query);
          return;
        }
        console.warn('Backend nicht erreichbar, verwende lokale KI');
        AppConfig.setMode('local');
        this.updateModeIndicator();
      }

      // Mode 1: Lokale NLP-KI
      const result = AIEngine.findBestAnswer(query);

      if (result && result.answer && result.confidence >= 0.35) {
        const confidenceText = AIEngine.formatConfidence(result.confidence);
        answerText = `${confidenceText}\n\n${result.answer}`;
        if (result.related && result.related.length > 0) {
          answerText += '\n\n**Mehr dazu:**';
          result.related.slice(0, 2).forEach(r => {
            answerText += `\n• ${r.question}`;
          });
        }
        this.conversationHistory.push({ role: 'assistant', content: result.answer });
        followUpSuggestions = this.getFollowUpQuestions(result.category, query);
        this.hideTyping();
        this._lastResponseShown = true;
        this.addBotMessage(answerText, { sourceUrl: result.source, sources: result.sources || [result.category], suggestions: followUpSuggestions });
        try { this.showSuggestions(result.category, query); } catch (e2) { console.error('showSuggestions error:', e2); }
      } else {
        const suggestions = (result && result.suggestions) || [];
        const fallback = AIEngine.generateFallback(query, suggestions);
        followUpSuggestions = this.getFallbackSuggestions(query);
        this.hideTyping();
        this._lastResponseShown = true;
        this.addBotMessage(
          `**Ich habe keine passende Antwort gefunden.**\n\n${fallback}`,
          { sources: [], suggestions: followUpSuggestions }
        );
        try { this.showSuggestions(null, query); } catch (e2) { console.error('showSuggestions error:', e2); }
      }
    } catch (e) {
      console.error('Fehler bei der Antwortfindung:', e);
      this.hideTyping();
      this._lastResponseShown = true;
      const errMsg = e?.message || 'Unbekannter Fehler';
      this.addBotMessage(
        '**Es ist ein technischer Fehler aufgetreten.**\n\n' +
        'Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, ' +
        'laden Sie die Seite neu oder wenden Sie sich an die QM-Abteilung.' +
        `\n\n_(Fehler: ${ChatbotUI.escapeHtml(errMsg)})_`,
        { sources: [] }
      );
      try { this.showSuggestions(); } catch (e2) { console.error('showSuggestions error:', e2); }
    }
  },

  getFollowUpQuestions(category, lastQuery) {
    let pool;
    if (category) {
      pool = KnowledgeBase.getByCategory(category);
    } else {
      pool = KnowledgeBase.getAll();
    }
    // Ähnlichste Fragen zur letzten Frage
    if (lastQuery) {
      const scored = AIEngine.search(lastQuery);
      if (scored.length > 0) {
        pool = scored;
      }
    }
    // Maximal 4, möglichst unterschiedliche Fragen
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 4);
    return shuffled.map(r => r.question || r);
  },

  getFallbackSuggestions(query) {
    // Bei fehlender Antwort: thematisch passende Fragen vorschlagen
    const tokens = AIEngine.tokenize(query);
    const all = KnowledgeBase.getAll();
    const scored = all.map(item => {
      const itemTokens = AIEngine.tokenize(item.question + ' ' + item.answer);
      const sim = AIEngine.bigramSimilarity(tokens, itemTokens);
      return { item, sim };
    });
    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, 4).map(r => r.item.question);
  },

  askQuestion(question) {
    this.inputEl.value = question;
    this.sendMessage();
  },

  showSuggestions(category, lastQuery) {
    let kb;
    if (category) {
      kb = KnowledgeBase.getByCategory(category);
    } else {
      kb = KnowledgeBase.getAll();
    }

    // KI-basierte Vorschläge: ähnlichste Fragen zur letzten Frage
    if (lastQuery) {
      const scored = AIEngine.search(lastQuery);
      if (scored.length > 0) {
        kb = scored.map(r => ({ question: r.question, category: r.category }));
      }
    }

    const shuffled = kb.sort(() => Math.random() - 0.5).slice(0, 6);
    this.suggestionsEl.innerHTML = shuffled.map(item =>
      `<button onclick="ChatbotUI.askQuestion('${this.escapeHtml(item.question)}')">${this.escapeHtml(item.question)}</button>`
    ).join('');
  },

  scrollDown() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  },

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

const FAQ = {
  init() {
    this.setupFilters();
    this.render();
  },

  setupFilters() {
    const container = document.querySelector('.category-filters');
    if (!container) return;
    const categories = KnowledgeBase.getCategories();
    container.innerHTML = '<button class="active" data-category="Alle" role="tab">Alle</button>';
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.dataset.category = cat;
      btn.textContent = cat;
      btn.setAttribute('role', 'tab');
      container.appendChild(btn);
    });
    this.filters = container.querySelectorAll('button');
    this.filters.forEach(btn => {
      btn.addEventListener('click', () => {
        this.filters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filter(btn.dataset.category);
      });
    });
  },

  filter(category) {
    const items = document.querySelectorAll('.faq-item');
    items.forEach(item => {
      const cat = item.dataset.category;
      item.style.display = (category === 'Alle' || cat === category) ? '' : 'none';
    });
  },

  render() {
    const list = document.querySelector('.faq-list');
    if (!list) return;
    const kb = KnowledgeBase.getAll().sort((a, b) => a.category.localeCompare(b.category));
    list.innerHTML = kb.map(item => `
      <div class="faq-item" data-category="${item.category}">
        <div class="faq-question" role="button" tabindex="0" aria-expanded="false">
          <span>${ChatbotUI.escapeHtml(item.question)}</span>
          <span class="arrow">▼</span>
        </div>
        <div class="faq-answer">${ChatbotUI.escapeHtml(item.answer)}</div>
      </div>
    `).join('');
    this.bindItems();
  },

  bindItems() {
    document.querySelectorAll('.faq-item').forEach(item => {
      const q = item.querySelector('.faq-question');
      q.addEventListener('click', () => {
        if (item.classList.contains('open')) {
          item.classList.remove('open');
          q.setAttribute('aria-expanded', 'false');
          item.querySelector('.faq-answer').style.maxHeight = '0';
        } else {
          document.querySelectorAll('.faq-item.open').forEach(i => {
            i.classList.remove('open');
            i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
            i.querySelector('.faq-answer').style.maxHeight = '0';
          });
          item.classList.add('open');
          q.setAttribute('aria-expanded', 'true');
          const answer = item.querySelector('.faq-answer');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
      q.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q.click(); }
      });
    });
  }
};

const Admin = {
  init() {
    this.modal = document.getElementById('admin-modal');
    this.loginModal = document.getElementById('admin-login-modal');
    this.form = document.getElementById('admin-form');
    this.tableBody = document.getElementById('admin-table-body');
    this.isAuthenticated = false;
    this.editingId = null;
    this.activeTab = 'kb';

    document.getElementById('admin-open').addEventListener('click', () => this.openLogin());
    document.getElementById('admin-login-btn').addEventListener('click', () => this.login());
    document.getElementById('admin-login-close').addEventListener('click', () => this.closeLogin());
    document.getElementById('admin-login-abort').addEventListener('click', () => this.closeLogin());
    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('admin-cancel').addEventListener('click', () => this.closeModal());
    document.getElementById('admin-add-btn').addEventListener('click', () => this.openNew());
    document.getElementById('admin-export-btn').addEventListener('click', () => this.exportData());
    document.getElementById('admin-reset-btn').addEventListener('click', () => this.confirmReset());
    document.getElementById('admin-logout-btn').addEventListener('click', () => this.logout());

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    document.getElementById('admin-password').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.login();
    });

    document.getElementById('toggle-password').addEventListener('click', () => {
      const input = document.getElementById('admin-password');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // Tab-Wechsel
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Playground: Verbindung testen
    document.getElementById('playground-test-btn')?.addEventListener('click', () => this.testOllamaConnection());
    // Playground: Config speichern
    document.getElementById('playground-save-btn')?.addEventListener('click', () => this.savePlaygroundConfig());
  },

  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));
    if (tab === 'playground') this.refreshPlayground();
  },

  openLogin() {
    this.loginModal.classList.add('open');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-login-error').textContent = '';
    document.getElementById('admin-password').focus();
  },

  closeLogin() {
    this.loginModal.classList.remove('open');
  },

  login() {
    const pw = document.getElementById('admin-password').value;
    if (pw === KnowledgeBase.getAdminPassword()) {
      this.isAuthenticated = true;
      this.closeLogin();
      this.openModal();
    } else {
      document.getElementById('admin-login-error').textContent = '❌ Falsches Passwort. Bitte versuchen Sie es erneut.';
    }
  },

  logout() {
    this.isAuthenticated = false;
    this.closeModal();
    this.showToast('Erfolgreich abgemeldet.');
  },

  openModal() {
    if (!this.isAuthenticated) {
      this.openLogin();
      return;
    }
    this.renderTable();
    this.modal.classList.add('open');
  },

  closeModal() {
    this.modal.classList.remove('open');
    this.editingId = null;
    this.form.reset();
    document.getElementById('admin-form-title').textContent = 'Neue Frage hinzufügen';
    document.getElementById('admin-cancel').textContent = 'Abbrechen';
    const delBtn = this.form.querySelector('.btn-delete');
    if (delBtn) delBtn.remove();
  },

  openNew() {
    this.editingId = null;
    document.getElementById('admin-form-title').textContent = 'Neue Frage hinzufügen';
    document.getElementById('admin-question').value = '';
    document.getElementById('admin-answer').value = '';
    document.getElementById('admin-source').value = '';
    document.getElementById('admin-category').value = 'Allgemein';
    document.getElementById('admin-cancel').textContent = 'Abbrechen';
    const delBtn = this.form.querySelector('.btn-delete');
    if (delBtn) delBtn.remove();
    document.getElementById('admin-form-wrapper').scrollIntoView({ behavior: 'smooth' });
  },

  edit(id) {
    const kb = KnowledgeBase.getAll();
    const item = kb.find(i => i.id === id);
    if (!item) return;
    this.editingId = id;
    document.getElementById('admin-form-title').textContent = 'Frage bearbeiten';
    document.getElementById('admin-question').value = item.question;
    document.getElementById('admin-answer').value = item.answer;
    document.getElementById('admin-source').value = item.source || '';
    document.getElementById('admin-category').value = item.category;
    document.getElementById('admin-cancel').textContent = 'Abbrechen';
    let delBtn = this.form.querySelector('.btn-delete');
    if (!delBtn) {
      delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete';
      delBtn.textContent = 'Löschen';
      delBtn.addEventListener('click', () => this.confirmDelete(id));
      const actions = this.form.querySelector('.form-actions');
      actions.insertBefore(delBtn, actions.firstChild);
    }
    document.getElementById('admin-form-wrapper').scrollIntoView({ behavior: 'smooth' });
  },

  save() {
    const question = document.getElementById('admin-question').value.trim();
    const answer = document.getElementById('admin-answer').value.trim();
    const category = document.getElementById('admin-category').value;
    const source = document.getElementById('admin-source').value.trim();
    if (!question || !answer) {
      this.showToast('Bitte füllen Sie alle Felder aus.', 'error');
      return;
    }
    if (this.editingId) {
      KnowledgeBase.update(this.editingId, { question, answer, category, source });
      this.showToast('Frage erfolgreich aktualisiert!');
    } else {
      KnowledgeBase.add({ question, answer, category, source });
      this.showToast('Neue Frage erfolgreich hinzugefügt!');
    }
    this.editingId = null;
    document.getElementById('admin-form-title').textContent = 'Neue Frage hinzufügen';
    this.form.reset();
    const delBtn = this.form.querySelector('.btn-delete');
    if (delBtn) delBtn.remove();
    this.renderTable();
    FAQ.render();
  },

  confirmDelete(id) {
    if (confirm('Möchten Sie diesen Eintrag wirklich löschen?')) {
      KnowledgeBase.remove(id);
      this.showToast('Eintrag gelöscht.');
      this.editingId = null;
      document.getElementById('admin-form-title').textContent = 'Neue Frage hinzufügen';
      this.form.reset();
      const delBtn = this.form.querySelector('.btn-delete');
      if (delBtn) delBtn.remove();
      this.renderTable();
      FAQ.render();
    }
  },

  confirmReset() {
    if (confirm('Möchten Sie die Wissensdatenbank wirklich auf die Standardeinträge zurücksetzen? Alle eigenen Änderungen gehen verloren!')) {
      KnowledgeBase.reset();
      this.renderTable();
      FAQ.render();
      this.showToast('Wissensdatenbank zurückgesetzt.');
    }
  },

  exportData() {
    const kb = KnowledgeBase.getAll();
    const blob = new Blob([JSON.stringify(kb, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lebenshilfe-wissensdatenbank-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Daten exportiert!');
  },

  renderTable() {
    const kb = KnowledgeBase.getAll().sort((a, b) => a.category.localeCompare(b.category));
    this.tableBody.innerHTML = kb.map(item => `
      <tr>
        <td>${ChatbotUI.escapeHtml(item.category)}</td>
        <td>${ChatbotUI.escapeHtml(item.question.length > 60 ? item.question.slice(0, 60) + '…' : item.question)}</td>
        <td>${ChatbotUI.escapeHtml(item.answer.length > 80 ? item.answer.slice(0, 80) + '…' : item.answer)}</td>
        <td>${item.source ? '<a href="' + ChatbotUI.escapeHtml(item.source) + '" target="_blank" rel="noopener">Quelle</a>' : '—'}</td>
        <td class="actions">
          <button class="edit-btn" onclick="Admin.edit(${item.id})" aria-label="Bearbeiten">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="del-btn" onclick="Admin.confirmDelete(${item.id})" aria-label="Löschen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </td>
      </tr>
    `).join('');
  },

  showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast show' + (type === 'error' ? ' error' : '');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  // ---- Playground (Ollama-Konfiguration) ----

  async refreshPlayground() {
    const statusEl = document.getElementById('playground-status');
    const urlEl = document.getElementById('playground-url');
    const modelEl = document.getElementById('playground-model');

    if (AppConfig.mode === 'ollama') {
      statusEl.innerHTML = '<span style="color:#00A336;font-weight:bold;">Verbunden</span>';
      statusEl.innerHTML += `<br><small>Backend: ${AppConfig.backendUrl}</small>`;
      urlEl.value = AppConfig.backendUrl;
      modelEl.value = AppConfig.ollamaModel;

      // Modelle laden
      await AppConfig.loadModels();
      const select = document.getElementById('playground-model-select');
      if (select && AppConfig.ollamaModels.length) {
        select.innerHTML = AppConfig.ollamaModels.map(m =>
          `<option value="${m}" ${m === AppConfig.ollamaModel ? 'selected' : ''}>${m}</option>`
        ).join('');
        select.style.display = '';
        modelEl.style.display = 'none';
      }
    } else {
      statusEl.innerHTML = '<span style="color:#EB6600;font-weight:bold;">🟡 Nicht verbunden</span>';
      statusEl.innerHTML += '<br><small>Backend nicht erreichbar. Starten Sie: <code>python backend/main.py</code></small>';
      urlEl.value = AppConfig.backendUrl || 'http://localhost:8000';
    }

    // Mode-Anzeige
    const modeRadios = document.querySelectorAll('input[name="ai-mode"]');
    modeRadios.forEach(r => r.checked = r.value === AppConfig.mode);
  },

  async testOllamaConnection() {
    const btn = document.getElementById('playground-test-btn');
    const resultEl = document.getElementById('playground-test-result');
    const url = document.getElementById('playground-url')?.value || 'http://localhost:8000';
    btn.disabled = true;
    btn.textContent = '⏳ Teste...';
    resultEl.innerHTML = '';

    const result = await AppConfig.testConnection(url);
    if (result.success) {
      resultEl.innerHTML = `<span style="color:#00A336;">Erfolgreich! Backend: ${result.data.mode}, Modell: ${result.data.ollama_model}, ${result.data.kb_entries} Wissenseinträge</span>`;
      AppConfig.backendUrl = url;
      AppConfig.mode = 'ollama';
      AppConfig.ollamaConnected = true;
      AppConfig.persist();
      ChatbotUI.updateModeIndicator();
      await this.refreshPlayground();
    } else {
      resultEl.innerHTML = `<span style="color:#dc3545;">❌ Fehler: ${result.error}</span>`;
    }
    btn.disabled = false;
    btn.textContent = 'Verbindung testen';
  },

  async savePlaygroundConfig() {
    const url = document.getElementById('playground-url')?.value;
    const modelInput = document.getElementById('playground-model')?.value;
    const modelSelect = document.getElementById('playground-model-select')?.value;

    const model = modelSelect || modelInput || AppConfig.ollamaModel;
    const updates = {};

    if (url && url !== AppConfig.backendUrl) updates.backendUrl = url;
    if (model && model !== AppConfig.ollamaModel) updates.ollamaModel = model;

    if (url && AppConfig.backendUrl) {
      const ok = await AppConfig.updateConfig({
        ollama_host: url,
        ollama_model: model,
      });
      if (ok) {
        AppConfig.backendUrl = url;
        AppConfig.ollamaModel = model;
        AppConfig.persist();
        this.showToast('Konfiguration gespeichert!');
      } else {
        this.showToast('Konfiguration lokal gespeichert (Backend nicht erreichbar)', 'error');
        AppConfig.backendUrl = url;
        AppConfig.ollamaModel = model;
        AppConfig.persist();
      }
    } else {
      AppConfig.backendUrl = url;
      AppConfig.ollamaModel = model;
      AppConfig.persist();
      this.showToast('✅ Konfiguration gespeichert!');
    }
    ChatbotUI.updateModeIndicator();
    await this.refreshPlayground();
  }
};

// ===== DOKUMENTEN-BROWSER =====
const DocBrowser = {
  documents: [],
  filtered: [],
  currentCat: 'Alle',
  searchHistory: [],

  init() {
    this.docList = document.getElementById('doc-list');
    this.catContainer = document.getElementById('doc-categories');
    this.searchInput = document.getElementById('doc-search-input');
    this.searchBtn = document.getElementById('doc-search-btn');

    this.loadDocuments();
    this.renderCategories();
    this.filtered = [...this.documents];
    this.renderList();

    this.searchBtn.addEventListener('click', () => this.filter());
    this.searchInput.addEventListener('input', () => this.filterDebounced());
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.filter();
    });

    this.catContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      this.catContainer.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.currentCat = btn.dataset.cat;
      this.filter();
    });

    document.getElementById('doc-preview-close').addEventListener('click', () => this.closePreview());
    document.getElementById('doc-preview-close-btn').addEventListener('click', () => this.closePreview());
    document.getElementById('doc-preview-download-btn').addEventListener('click', () => this.downloadCurrent());
    document.getElementById('doc-preview-modal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closePreview();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closePreview();
    });
  },

  loadDocuments() {
    const docs = KnowledgeBase.getAll();
    this.documents = docs.map((entry, i) => {
      const content = entry.answer.replace(/<[^>]*>/g, '');
      return {
        id: i,
        title: entry.question,
        description: content.substring(0, 120) + '…',
        category: entry.category || 'Allgemein',
        source: entry.source || '',
        type: 'pdf',
        date: '2024',
        filename: `dokument_${i + 1}.pdf`,
        content,
        // Pre-tokenize for faster search
        _tokens: DocBrowser.tokenize(entry.question + ' ' + content + ' ' + (entry.category || ''))
      };
    });
    const types = ['pdf', 'word', 'excel', 'pdf', 'pdf', 'word'];
    this.documents.forEach((d, i) => { d.type = types[i % types.length]; });
  },

  get categories() {
    const cats = [...new Set(this.documents.map(d => d.category))];
    return ['Alle', ...cats.sort()];
  },

  renderCategories() {
    this.catContainer.innerHTML = this.categories.map(cat =>
      `<button data-cat="${cat}" role="tab" class="${cat === 'Alle' ? 'active' : ''}">${cat}</button>`
    ).join('');
  },

  renderList(items) {
    const list = items || this.filtered;
    if (list.length === 0) {
      this.docList.innerHTML = '<div class="doc-empty">Keine Dokumente gefunden.</div>';
      return;
    }
    this.docList.innerHTML = list.map(doc => {
      const icon = this.typeIcon(doc.type);
      const name = doc._query ? this.highlight(doc.title, doc._query) : doc.title;
      const desc = doc._query ? this.highlight(doc.description, doc._query) : doc.description;
      return `
        <div class="doc-item" data-category="${doc.category}">
          <div class="doc-icon ${doc.type}">${icon}</div>
          <div class="doc-info">
            <div class="doc-name">${name}</div>
            <div class="doc-meta">
              <span>${doc.category}</span>
              <span>${doc.type.toUpperCase()}</span>
              <span>${doc.date}</span>
            </div>
            <div class="doc-desc">${desc}</div>
          </div>
          <div class="doc-actions">
            <button data-preview="${doc.id}">Vorschau</button>
            ${doc.source ? `<a href="${DocBrowser.escapeHtml(doc.source)}" target="_blank" rel="noopener noreferrer" class="doc-source-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Quelle</a>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.docList.querySelectorAll('[data-preview]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.preview);
        let doc = this.filtered.find(d => d.id === id);
        if (!doc) doc = this.documents.find(d => d.id === id);
        if (doc) this.showPreview(doc);
      });
    });
  },

  highlight(text, query) {
    const words = query.split(/\s+/).filter(w => w.length > 1);
    let result = this.escapeHtml(text);
    for (const word of words) {
      const re = new RegExp('(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      result = result.replace(re, '<mark style="background:#FFF3CD;padding:1px 2px;border-radius:3px;">$1</mark>');
    }
    return result;
  },

  escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },

  typeIcon(type) {
    const icons = {
      pdf: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
      word: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="16 13 14 17 12 13"/></svg>',
      excel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="8 13 12 17 8 17"/></svg>',
    };
    return icons[type] || icons.pdf;
  },

  /* ---------- Such-Algorithmen ---------- */

  debounceTimer: null,
  filterDebounced() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.filter(), 200);
  },

  filter() {
    const raw = this.searchInput.value.trim();
    const query = raw.toLowerCase();
    this._query = raw;

    if (!query) {
      this.filtered = this.currentCat === 'Alle'
        ? [...this.documents]
        : this.documents.filter(d => d.category === this.currentCat);
      return this.renderList(this.filtered);
    }

    // 1. Kategorie-Vorauswahl
    const catFiltered = this.currentCat === 'Alle'
      ? this.documents
      : this.documents.filter(d => d.category === this.currentCat);

    // 2. Mehrere Algorithmen parallel anwenden
    const scored = catFiltered.map(doc => {
      const score = this.computeScore(doc, query);
      return { ...doc, _score: score };
    });

    // 3. Nur relevante Ergebnisse (Score > 0)
    this.filtered = scored
      .filter(d => d._score > 0)
      .sort((a, b) => b._score - a._score);

    // 4. Query für Highlighting merken
    this.filtered.forEach(d => { d._query = raw; });

    this.renderList(this.filtered);
  },

  computeScore(doc, query) {
    const qTokens = DocBrowser.tokenize(query);
    if (qTokens.length === 0) return query.length <= 2 ? 1 : 0;

    const titleLow = doc.title.toLowerCase();
    const descLow = doc.description.toLowerCase();
    const filenameLow = doc.filename.toLowerCase();
    const catLow = doc.category.toLowerCase();
    const allText = titleLow + ' ' + descLow + ' ' + filenameLow + ' ' + catLow;

    let score = 0;

    // --- Algorithmus 1: Exakte Phrasenübereinstimmung (höchste Gewichtung) ---
    if (allText.includes(query)) {
      score += 100;
      // Extra-Bonus wenn im Titel
      if (titleLow.includes(query)) score += 50;
    }

    // --- Algorithmus 2: Vollständige Token-Übereinstimmung ---
    const docTokens = doc._tokens || DocBrowser.tokenize(doc.title + ' ' + doc.description + ' ' + doc.category);
    const matchedTokens = qTokens.filter(t => docTokens.includes(t));
    score += matchedTokens.length * 15;

    // --- Algorithmus 3: Teilwort / Substring-Matching ---
    for (const qt of qTokens) {
      if (qt.length < 3) continue;
      // Enthalten im Titel
      if (titleLow.includes(qt)) score += 10;
      // Enthalten in Beschreibung
      else if (descLow.includes(qt)) score += 5;
      // Enthalten im Dateinamen
      else if (filenameLow.includes(qt)) score += 8;
      // Enthalten in Kategorie
      else if (catLow.includes(qt)) score += 4;

      // --- Algorithmus 4: Fuzzy / Levenshtein (Tippfehler-Toleranz) ---
      const fuzzy = DocBrowser.fuzzyFind(qt, docTokens);
      if (fuzzy.found) score += fuzzy.score;
    }

    // --- Algorithmus 5: Stemming (Wortstamm-Reduktion) ---
    if (typeof AIEngine !== 'undefined' && AIEngine.stem) {
      for (const qt of qTokens) {
        const stemmed = AIEngine.stem(qt);
        if (stemmed !== qt && docTokens.some(t => t.includes(stemmed) || stemmed.includes(t))) {
          score += 8;
        }
      }
    }

    // --- Algorithmus 6: Synonym-Erweiterung ---
    if (typeof AIEngine !== 'undefined' && AIEngine.synonyms) {
      for (const qt of qTokens) {
        const expanded = AIEngine.synonyms[qt];
        if (expanded && expanded !== qt) {
          const expTokens = DocBrowser.tokenize(expanded);
          const synMatch = expTokens.filter(t => docTokens.includes(t));
          score += synMatch.length * 6;
        }
      }
    }

    // --- Algorithmus 7: Bigram-Ähnlichkeit (Jaccard) ---
    const bigramScore = DocBrowser.bigramSimilarity(qTokens, docTokens);
    score += bigramScore * 20;

    // --- Algorithmus 8: Pfad-Bonus für Netzwerkpfade ---
    const isNetPath = filenameLow.startsWith('\\\\') || filenameLow.includes(':/');
    if (isNetPath && matchedTokens.length > 0) {
      score += 5; // Netzwerkdokumente bevorzugen wenn Treffer
    }

    return score;
  },

  /* ---------- Hilfsfunktionen ---------- */

  // Levenshtein-Fuzzy-Suche: findet ähnliche Tokens (Tippfehler-erlaubt)
  fuzzyFind(token, candidates, maxDist) {
    maxDist = maxDist || Math.max(1, Math.floor(token.length / 3));
    let best = { found: false, score: 0, match: '' };
    for (const c of candidates) {
      if (c === token) continue;
      const dist = DocBrowser.levenshtein(token, c);
      if (dist <= maxDist && dist > 0) {
        const sim = 1 - dist / Math.max(token.length, c.length);
        const s = Math.round(sim * 12);
        if (s > best.score) best = { found: true, score: s, match: c };
      }
    }
    return best;
  },

  levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
    return dp[m][n];
  },

  // Tokenisierung (wie AIEngine, aber ohne Stopwort-Filter für Dokumente)
  tokenize(text) {
    if (!text) return [];
    return text.toLowerCase()
      .replace(/[.,!?;:()""''«»\-–—/\\\[\]{}|@#$%^&*+=<>~`]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  },

  bigramSimilarity(tokens1, tokens2) {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  },

  showPreview(doc) {
    if (!doc) return;
    this._currentDoc = doc;
    document.getElementById('doc-preview-title').textContent = doc.title;
    document.getElementById('doc-preview-meta').innerHTML = `
      <dl>
        <dt>Kategorie</dt><dd>${doc.category}</dd>
        <dt>Dateityp</dt><dd>${doc.type.toUpperCase()}</dd>
        <dt>Datum</dt><dd>${doc.date}</dd>
        <dt>Dateiname</dt><dd>${doc.filename}</dd>
        <dt>Netzwerkpfad</dt><dd style="font-family:monospace;font-size:0.8rem;word-break:break-all;">\\\\lsserver\\qm-handbuch\\${doc.filename}</dd>
        ${doc.source ? `<dt>Quelle</dt><dd><a href="${this.escapeHtml(doc.source)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(doc.source)}</a></dd>` : ''}
      </dl>
    `;
    document.getElementById('doc-preview-body').innerHTML = `
      <h4>Inhaltsvorschau</h4>
      <p>${doc.content}</p>
    `;
    document.getElementById('doc-preview-modal').classList.add('open');
  },

  downloadCurrent() {
    const doc = this._currentDoc;
    if (!doc) return;
    const content = `Titel: ${doc.title}\nKategorie: ${doc.category}\nDateityp: ${doc.type.toUpperCase()}\nDatum: ${doc.date}\nDateiname: ${doc.filename}\nNetzwerkpfad: \\\\lsserver\\qm-handbuch\\${doc.filename}${doc.source ? `\nQuelle: ${doc.source}` : ''}\n\n--- Inhaltsvorschau ---\n\n${doc.content}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename.replace(/\.\w+$/, '') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  closePreview() {
    this._currentDoc = null;
    document.getElementById('doc-preview-modal').classList.remove('open');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await ChatbotUI.init();
  } catch (e) {
    console.error('Chatbot init error:', e);
    document.getElementById('chat-messages')?.insertAdjacentHTML('beforeend',
      '<div class="chat-message bot"><div class="avatar bot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><div class="bubble">Initialisierung fehlgeschlagen. Seite neu laden?</div></div>');
  }
  try { FAQ.init(); } catch (e) { console.error('FAQ init error:', e); }
  try { Admin.init(); } catch (e) { console.error('Admin init error:', e); }
  try { DocBrowser.init(); } catch (e) { console.error('DocBrowser init error:', e); }
});
