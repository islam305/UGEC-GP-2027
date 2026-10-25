/* UGEC: reference links, review archive and private grade tables */
(() => {
  'use strict';

  if (window.UGEC_REVIEWS_V1) return;
  window.UGEC_REVIEWS_V1 = true;

  fields.tasks.push('referenceLink');
  fields.submissions.push('reviewArchived');

  let taskFilter = '';
  let archiveFilter = 'active';

  const scored = s =>
    s &&
    s.score !== '' &&
    s.score != null &&
    Number.isFinite(Number(s.score)) &&
    Number(s.score) >= 0 &&
    Number(s.score) <= 100;

  const canArchive = s =>
    scored(s) &&
    ['approved', 'revision'].includes(s.status);

  const ordered = items =>
    items.slice().sort((a, b) =>
      (Date.parse(b.date) || 0) -
      (Date.parse(a.date) || 0) ||
      String(b.id).localeCompare(String(a.id))
    );

  /* إظهار تاب التقييم للفريق بعد الدخول */
  const originalEstablish = establish;

  establish = async function (...args) {
    const result = await originalEstablish(...args);

    $('tabReviewsBtn').classList.toggle(
      'hidden',
      !state.isMentor && !state.currentUni
    );

    return result;
  };

  /* تحميل رابط المرجع عند تعديل التاسك */
  const originalOpenTask = openAddTaskModal;

  openAddTaskModal = function (id = null) {
    originalOpenTask(id);

    $('taskReferenceLink').value =
      state.tasks.find(t => t.id === id)?.referenceLink || '';
  };

  /* حفظ التاسك مع الرابط الاختياري */
  saveTask = function (e) {
    e.preventDefault();

    return run(async () => {
      requireMentor();

      const id = $('taskId').value || uid();
      const old = state.tasks.find(t => t.id === id);

      await commit('tasks', id, {
        ...old,
        title: $('taskTitle').value,
        desc: $('taskDesc').value,
        deadline: $('taskDeadline').value,
        format: $('taskFormat').value,
        createdAt: old?.createdAt || Date.now(),
        referenceLink: externalURL(
          $('taskReferenceLink').value.trim()
        )
      });
    });
  };

  /* زر المرجع في الرئيسية وقائمة التاسكات */
  const originalTaskActions = taskActions;

  taskActions = function (task) {
    const actions = originalTaskActions(task);

    if (task.referenceLink) {
      actions.push(
        button(
          'فتح الملف المرجعي',
          () => openFile(task, 'referenceLink')
        )
      );
    }

    return actions;
  };

  /* الأرشفة تحفظ التسليم والدرجة والملاحظات */
  async function setArchived(id, archived) {
    return run(async () => {
      requireMentor();

      const sub = state.submissions.find(s => s.id === id);

      if (!sub) {
        throw Error('التسليم غير موجود. حدّث البيانات.');
      }

      if (archived && !canArchive(sub)) {
        throw Error(
          'أكمل التقييم وحدد الحالة معتمد أو يحتاج تعديل أولًا.'
        );
      }

      await commit('submissions', id, {
        ...sub,
        reviewArchived: archived
      });
    });
  }

  function eligibleSubmissions() {
    if (state.isMentor) return state.submissions;

    if (!state.currentUni) return [];

    return state.submissions.filter(
      s => s.uniId === state.currentUni
    );
  }

  function taskChoices(submissions) {
    const choices = new Map(
      state.tasks.map(t => [t.id, t])
    );

    submissions.forEach(s => {
      if (!choices.has(s.taskId)) {
        choices.set(s.taskId, {
          id: s.taskId,
          title: 'تاسك محذوف (' + s.taskId + ')'
        });
      }
    });

    return [...choices.values()];
  }

  /* جدول آخر تسليم لكل فريق في التاسك */
  function tableFor(task, submissions, teams) {
    const section = node(
      'section',
      undefined,
      'ugec-card rounded-2xl p-4 space-y-2'
    );

    section.append(node('h3', task.title, 'font-bold'));

    const latest = new Map();

    ordered(
      submissions.filter(s => s.taskId === task.id)
    ).forEach(s => {
      if (!latest.has(s.uniId)) {
        latest.set(s.uniId, s);
      }
    });

    const visibleTeams = new Map(
      teams.map(u => [u.id, u])
    );

    latest.forEach((s, id) => {
      if (!visibleTeams.has(id)) {
        visibleTeams.set(id, {
          id,
          name: 'فريق ' + id
        });
      }
    });

    const values = [...latest.values()]
      .filter(scored)
      .map(s => Number(s.score));

    const average = values.length
      ? (
          values.reduce((a, b) => a + b, 0) /
          values.length
        ).toFixed(1) + '/100'
      : '—';

    section.append(
      node(
        'p',
        'فرق سلّمت: ' + latest.size +
        ' • نتائج بدرجة: ' + values.length +
        ' • متوسط الدرجات: ' + average,
        'text-sm text-slate-400'
      )
    );

    const wrap = node(
      'div',
      undefined,
      'overflow-x-auto'
    );

    const table = node(
      'table',
      undefined,
      'table-ugec'
    );

    table.append(
      node(
        'caption',
        'آخر تسليم لكل فريق؛ الأرشفة لا تحذف الدرجات.',
        'text-xs text-slate-400'
      )
    );

    const head = node('thead');
    const headerRow = node('tr');

    [
      'الجامعة',
      'الفريق',
      'الإصدار',
      'تاريخ التسليم',
      'الحالة',
      'الدرجة /100',
      'ملاحظات رئيسية',
      'ملاحظات فرعية'
    ].forEach(text => {
      const th = node('th', text);
      th.scope = 'col';
      headerRow.append(th);
    });

    head.append(headerRow);
    table.append(head);

    const body = node('tbody');

    visibleTeams.forEach(u => {
      const s = latest.get(u.id);
      const row = node('tr');

      [
        u.name || u.id,
        u.group || '—',
        s?.rev || '—',
        s ? dateText(s.date) : '—',
        s ? statusText(s.status) : 'لم يسلّم',
        s
          ? (scored(s) ? String(s.score) : 'بانتظار التقييم')
          : '—',
        s?.major || '—',
        s?.minor || '—'
      ].forEach(value => {
        row.append(
          node('td', value, 'whitespace-pre-wrap')
        );
      });

      body.append(row);
    });

    table.append(body);
    wrap.append(table);
    section.append(wrap);

    if (!visibleTeams.size) {
      section.append(
        node(
          'p',
          'لا توجد بيانات فرق متاحة لهذا الحساب.',
          'text-sm text-slate-400'
        )
      );
    }

    return section;
  }

  /* كارت المراجعة للمشرف */
  function reviewCard(s) {
    const task = state.tasks.find(
      t => t.id === s.taskId
    );

    const team = state.universities.find(
      u => u.id === s.uniId
    );

    const actions = [
      button(
        'تقييم / تعديل التقييم',
        () => openReview(s.id)
      )
    ];

    if (s.fileLink || s.storagePath) {
      actions.push(
        button(
          'فتح التسليم',
          () => openFile(s, 'fileLink')
        )
      );
    }

    if (s.reviewArchived === true) {
      actions.push(
        button(
          'استعادة للمراجعات',
          () => setArchived(s.id, false)
        )
      );
    } else if (canArchive(s)) {
      actions.push(
        button(
          'أرشفة بعد التقييم',
          () => setArchived(s.id, true)
        )
      );
    }

    return card(
      (team?.name || s.uniId) +
      ' • ' +
      (task?.title || 'تاسك محذوف'),
      [
        'الإصدار: ' + (s.rev || '—') +
        ' • ' + dateText(s.date),

        'الحالة: ' + statusText(s.status) +
        (s.reviewArchived === true ? ' • مؤرشف' : ''),

        'الدرجة: ' +
        (scored(s) ? s.score + '/100' : 'بانتظار التقييم'),

        'الملف: ' + (s.fileName || '—'),
        s.notes || '',
        'ملاحظات رئيسية: ' + (s.major || '—'),
        'ملاحظات فرعية: ' + (s.minor || '—'),
        legacyReferenceText(s)
      ],
      actions
    );
  }

  /* تحديث واجهة التقييم بحسب الحساب */
  renderReviews = function () {
    const mentor = state.isMentor;

    $('tabReviewsBtn').classList.toggle(
      'hidden',
      !mentor && !state.currentUni
    );

    $('reviewArchiveControl').classList.toggle(
      'hidden',
      !mentor
    );

    $('reviewQueueTitle').classList.toggle(
      'hidden',
      !mentor
    );

    $('reviewsList').classList.toggle(
      'hidden',
      !mentor
    );

    $('reviewsList').style.display = mentor ? '' : 'none';

    $('reviewsCaption').textContent = mentor
      ? 'أرشفة التسليمات المقيّمة مع بقاء الدرجات. الجدول يعرض آخر تسليم لكل فريق.'
      : 'درجات وملاحظات فريقك فقط. الجدول يعرض آخر تسليم لكل تاسك.';

    const submissions = eligibleSubmissions();
    const choices = taskChoices(submissions);

    if (!choices.some(t => t.id === taskFilter)) {
      taskFilter = '';
    }

    const select = $('reviewTaskFilter');
    select.replaceChildren();

    const allOption = node('option', 'كل التاسكات');
    allOption.value = '';
    select.append(allOption);

    choices.forEach(t => {
      const option = node('option', t.title);
      option.value = t.id;
      select.append(option);
    });

    select.value = taskFilter;

    const teams = mentor
      ? state.universities
      : state.universities.filter(
          u => u.id === state.currentUni
        );

    list(
      'reviewGradeTables',
      choices.filter(
        t => !taskFilter || t.id === taskFilter
      ),
      t => tableFor(t, submissions, teams)
    );

    const queue = mentor
      ? ordered(
          submissions.filter(s =>
            (!taskFilter || s.taskId === taskFilter) &&
            (
              archiveFilter === 'all' ||
              (
                archiveFilter === 'archived'
                  ? s.reviewArchived === true
                  : s.reviewArchived !== true
              )
            )
          )
        )
      : [];

    list('reviewsList', queue, reviewCard);
  };

  /* إضافة الحقول والفلاتر إلى HTML الموجود */
  function mount() {
    const label = node(
      'label',
      'رابط الملف المرجعي — اختياري',
      'block text-sm text-slate-300'
    );

    label.htmlFor = 'taskReferenceLink';

    const input = node(
      'input',
      undefined,
      'ugec-input'
    );

    input.id = 'taskReferenceLink';
    input.type = 'url';
    input.dir = 'ltr';
    input.placeholder = 'https://...';

    $('taskDesc').after(label, input);

    const caption = document.querySelector(
      '#tab-reviews .text-xs'
    );

    caption.id = 'reviewsCaption';

    const toolbar = node(
      'div',
      undefined,
      'flex flex-wrap gap-3 mb-4'
    );

    const taskLabel = node(
      'label',
      'التاسك',
      'text-sm'
    );

    const taskSelect = node(
      'select',
      undefined,
      'ugec-input'
    );

    taskSelect.id = 'reviewTaskFilter';

    taskSelect.addEventListener('change', () => {
      taskFilter = taskSelect.value;
      renderReviews();
    });

    taskLabel.append(taskSelect);
    toolbar.append(taskLabel);

    const archiveLabel = node(
      'label',
      'قائمة المراجعات',
      'text-sm hidden'
    );

    archiveLabel.id = 'reviewArchiveControl';

    const archiveSelect = node(
      'select',
      undefined,
      'ugec-input'
    );

    [
      ['active', 'المراجعات الحالية'],
      ['archived', 'الأرشيف'],
      ['all', 'الكل']
    ].forEach(([value, text]) => {
      const option = node('option', text);
      option.value = value;
      archiveSelect.append(option);
    });

    archiveSelect.addEventListener('change', () => {
      archiveFilter = archiveSelect.value;
      renderReviews();
    });

    archiveLabel.append(archiveSelect);
    toolbar.append(archiveLabel);

    const tables = node(
      'div',
      undefined,
      'space-y-4 mb-6'
    );

    tables.id = 'reviewGradeTables';

    const heading = node(
      'h3',
      'قائمة التسليمات للمراجعة',
      'font-bold mb-3 hidden'
    );

    heading.id = 'reviewQueueTitle';

    $('reviewsList').before(
      toolbar,
      tables,
      heading
    );

    renderReviews();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  /* فلتر الجامعة والحذف النهائي للتسليم */
  if (!window.UGEC_REVIEW_TOOLS_V1) {
    window.UGEC_REVIEW_TOOLS_V1 = true;

    let universityFilter = '';

    /* تصفية تسليمات المشرف بالجامعة المختارة */
    const previousSubmissions = eligibleSubmissions;

    eligibleSubmissions = function () {
      const items = previousSubmissions();

      return state.isMentor && universityFilter
        ? items.filter(s => s.uniId === universityFilter)
        : items;
    };

    /* تطبيق نفس الفلتر على جداول الدرجات */
    const previousTable = tableFor;

    tableFor = function (task, submissions, teams) {
      const selectedTeams = state.isMentor && universityFilter
        ? teams.filter(u => u.id === universityFilter)
        : teams;

      return previousTable(task, submissions, selectedTeams);
    };

    /* حذف إصدار واحد فقط من التسليم */
    async function deleteSubmissionPermanently(id) {
      return run(async () => {
        requireMentor();

        const submission = state.submissions.find(
          s => s.id === id
        );

        const record = rows.get(key('submissions', id));

        if (!submission || !record) {
          throw Error('التسليم غير موجود. حدّث البيانات.');
        }

        const task = state.tasks.find(
          t => t.id === submission.taskId
        );

        const team = state.universities.find(
          u => u.id === submission.uniId
        );

        const message =
          'حذف نهائي لهذا الإصدار من التسليم؟\n' +
          (task?.title || submission.taskId) +
          ' — ' +
          (team?.name || submission.uniId) +
          '\nستُحذف درجته وملاحظاته وقد يتغير جدول الإحصائيات.' +
          '\nلن يُحذف التاسك أو باقي الإصدارات أو الملف الخارجي.' +
          '\nلا يمكن التراجع عن الحذف.';

        if (!confirm(message)) return;

        const { data, error } = await db
          .from('ugec_documents')
          .delete()
          .eq('kind', 'submissions')
          .eq('id', id)
          .eq('version', record.version)
          .select('id');

        if (error) throw error;

        if (!data?.length) {
          throw Error(
            'لم يُحذف التسليم؛ حدّث البيانات وتحقق من الصلاحية.'
          );
        }

        await reloadData();
      });
    }

    /* إضافة السلة بجوار أزرار المراجعة والأرشفة */
    const previousReviewCard = reviewCard;

    reviewCard = function (submission) {
      const result = previousReviewCard(submission);

      if (state.isMentor) {
        const trash = button(
          'حذف نهائي',
          () => deleteSubmissionPermanently(submission.id)
        );

        const icon = node(
          'i',
          undefined,
          'fa-solid fa-trash-can'
        );

        icon.setAttribute('aria-hidden', 'true');
        trash.prepend(icon);

        trash.style.color = '#fb7185';
        trash.style.borderColor = '#be4666';
        trash.title = 'حذف هذا الإصدار ودرجته وملاحظاته نهائيًا';

        result.lastElementChild.append(trash);
      }

      return result;
    };

    /* قائمة اختيار الجامعة للمشرف */
    const previousRenderReviews = renderReviews;

    renderReviews = function () {
      let control = $('reviewUniversityControl');

      if (!control && $('reviewArchiveControl')) {
        control = node('label', 'الجامعة', 'text-sm');
        control.id = 'reviewUniversityControl';

        const select = node(
          'select',
          undefined,
          'ugec-input'
        );

        select.id = 'reviewUniversityFilter';

        select.addEventListener('change', () => {
          universityFilter = select.value;
          renderReviews();
        });

        control.append(select);

        $('reviewArchiveControl')
          .parentElement.prepend(control);
      }

      if (control) {
        const mentor = state.isMentor;

        control.classList.toggle('hidden', !mentor);

        const select = $('reviewUniversityFilter');
        select.replaceChildren();

        if (!mentor) {
          universityFilter = '';
        } else {
          if (!state.universities.some(
            u => u.id === universityFilter
          )) {
            universityFilter = '';
          }

          const all = node('option', 'كل الجامعات');
          all.value = '';
          select.append(all);

          state.universities.forEach(u => {
            const option = node(
              'option',
              u.name + (u.group ? ' — ' + u.group : '')
            );

            option.value = u.id;
            select.append(option);
          });

          select.value = universityFilter;
        }
      }

      return previousRenderReviews();
    };
  }
})();