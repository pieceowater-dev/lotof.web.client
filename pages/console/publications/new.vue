<template>
  <div class="publication-builder flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">

    <!-- ── TOP BAR ──────────────────────────────────────────────────────── -->
    <header class="flex-shrink-0 flex items-center justify-between gap-2 h-14 px-3 md:px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30">
      <!-- Left: breadcrumb (desktop) or title (mobile) -->
      <div class="hidden md:flex items-center gap-2 min-w-0 text-sm flex-1">
        <NuxtLink
          to="/console"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium"
        >{{ t('admin.panel') }}</NuxtLink>
        <Icon name="lucide:chevron-right" class="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
        <NuxtLink
          to="/console/publications"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium"
        >{{ t('admin.publications') }}</NuxtLink>
        <Icon name="lucide:chevron-right" class="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
        <span class="font-semibold text-slate-900 dark:text-white truncate">{{ t('admin.newPublication') }}</span>
      </div>
      
      <!-- Mobile: title only -->
      <div class="md:hidden text-sm font-semibold text-slate-900 dark:text-white truncate">
        {{ t('admin.newPublication') }}
      </div>

      <!-- Right: status + actions -->
      <div class="flex items-center gap-1 md:gap-3 flex-shrink-0 ml-auto">
        <span
          class="hidden sm:inline text-xs px-2.5 py-1 rounded-full font-semibold border"
          :class="article.status === 'published'
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'"
        >
          {{ article.status === 'published' ? t('admin.editor.statusPublished') : t('admin.editor.statusDraft') }}
        </span>
        <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          :disabled="!isDirty"
          class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 font-medium transition-colors"
          :class="isDirty
            ? 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer'
            : 'text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'"
          @click="saveDraft"
        >
          <Icon name="lucide:save" :class="['h-3.5 w-3.5', isSaving && 'animate-pulse']" />
          <span class="hidden md:inline">{{ isDirty ? t('app.save') : 'Сохранено' }}</span>
        </button>
        <button
          class="hidden sm:flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25 font-semibold"
          @click="publish"
        >
          <Icon name="lucide:send" class="h-3.5 w-3.5" />
          <span class="hidden md:inline">{{ t('admin.editor.publish') }}</span>
        </button>
      </div>
    </header>

    <!-- ── BODY ─────────────────────────────────────────────────────────── -->
    <div class="flex flex-1 overflow-hidden relative">

      <!-- ── CANVAS ──────────────────────────────────────────────────── -->
      <main class="flex-1 overflow-y-auto" @click.self="closeAll">
        <div class="min-h-full py-8 px-4">
          <!-- Document card -->
          <div class="mx-auto max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-black/30 border border-slate-200/60 dark:border-slate-800">
            <!-- Title area -->
            <div class="px-12 pt-10 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div
                ref="titleEl"
                contenteditable="true"
                  :data-placeholder="t('admin.editor.titlePlaceholder')"
                class="text-4xl font-bold text-slate-900 dark:text-white leading-snug outline-none w-full
                       empty:before:content-[attr(data-placeholder)] empty:before:text-slate-200 dark:empty:before:text-slate-700"
                @input="article.title = ($event.target as HTMLElement).innerText; syncSlug()"
              />
              <!-- Slug preview -->
              <button
                class="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 transition-colors group/slug"
                @click="sidebarTab = 'seo'"
              >
                <Icon name="lucide:globe" class="h-3 w-3" />
                <span class="group-hover/slug:underline">{{ article.slug ? '/' + article.slug : t('admin.editor.setUrl') }}</span>
                <Icon name="lucide:pen-line" class="h-3 w-3 opacity-0 group-hover/slug:opacity-100 transition-opacity" />
              </button>
            </div>

            <!-- ── BLOCKS ─────────────────────────────────────────────── -->
            <div class="px-12 py-6 pb-16">

              <template v-for="(block, i) in blocks" :key="block.id">

                <!-- Add button between blocks (hidden by default, shown on group hover) -->
                <div class="group/block-spacer -mx-3">
                  <PublicationEditorAddBetweenBlock :index="i" @open="openPicker(i)" />
                </div>

                <!-- Block wrapper -->
                <div
                  class="group relative -mx-3 rounded-xl transition-colors duration-150"
                  :class="{
                    'bg-blue-50/60 dark:bg-blue-950/20': activeBlockId === block.id,
                    'hover:bg-slate-50 dark:hover:bg-slate-800/40': activeBlockId !== block.id,
                    'opacity-30 pointer-events-none': dragState.index === i,
                  }"
                  @dragover.prevent="onDragOver(i)"
                  @drop.prevent="onDrop(i)"
                  @click="activeBlockId = block.id"
                >
                  <!-- Drop indicator -->
                  <div
                    v-if="dragState.over === i && dragState.index !== i"
                    class="absolute -top-0.5 left-3 right-3 h-0.5 bg-blue-500 rounded-full"
                  />

                  <!-- Active left border indicator -->
                  <div
                    v-if="activeBlockId === block.id"
                    class="absolute left-0 top-2 bottom-2 w-0.5 bg-blue-500 rounded-full"
                  />

                  <!-- Drag handle (appears left of block on hover) -->
                  <button
                    draggable="true"
                    class="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity
                           text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400
                           hover:bg-slate-100 dark:hover:bg-slate-700 cursor-grab active:cursor-grabbing"
                    title="Перетащить блок"
                    @dragstart="startDrag(i, $event)"
                    @dragend.prevent="endDrag"
                  >
                    <Icon name="lucide:grip-vertical" class="h-4 w-4" />
                  </button>

                  <!-- Action toolbar (top-right on hover) -->
                  <div
                    class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity
                           flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                           rounded-lg shadow-sm p-0.5 z-10"
                    @click.stop
                  >
                    <!-- Block type badge -->
                    <span class="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 uppercase">
                      {{ blockTypeLabel(block.type) }}
                    </span>
                    <div class="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                    <button
                      class="p-1 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      title="Дублировать"
                      @click="duplicateBlock(i)"
                    ><Icon name="lucide:copy" class="h-3.5 w-3.5" /></button>
                    <button
                      class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="Вверх"
                      @click="moveBlock(i, -1)"
                    ><Icon name="lucide:chevron-up" class="h-3.5 w-3.5" /></button>
                    <button
                      class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      title="Вниз"
                      @click="moveBlock(i, 1)"
                    ><Icon name="lucide:chevron-down" class="h-3.5 w-3.5" /></button>
                    <div class="w-px h-3.5 bg-slate-200 dark:bg-slate-700" />
                    <button
                      class="p-1 rounded text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Удалить"
                      @click="deleteBlock(i)"
                    ><Icon name="lucide:trash-2" class="h-3.5 w-3.5" /></button>
                  </div>

                  <!-- ── BLOCK CONTENT ──────────────────────────── -->
                  <div class="px-3 py-1.5">

                    <!-- HEADING -->
                    <component
                      :is="block.type"
                      v-if="['h2','h3','h4','h5'].includes(block.type)"
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      :data-placeholder="headingPlaceholder(block.type)"
                      class="outline-none w-full
                             empty:before:content-[attr(data-placeholder)] empty:before:text-slate-200 dark:empty:before:text-slate-700"
                      :class="headingClass(block.type)"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="onBlockKeydown(block, i, $event)"
                      @focus="onBlockFocus(block)"
                    />

                    <!-- PARAGRAPH -->
                    <p
                      v-else-if="block.type === 'paragraph'"
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      data-placeholder="Начните вводить текст..."
                      class="outline-none w-full leading-7 text-slate-700 dark:text-slate-300 text-[15px]
                             empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="onBlockKeydown(block, i, $event)"
                      @focus="onBlockFocus(block)"
                      @mouseup="onTextMouseUp"
                    />

                    <!-- QUOTE -->
                    <blockquote
                      v-else-if="block.type === 'quote'"
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      data-placeholder="Цитата..."
                      class="outline-none w-full border-l-[3px] border-blue-400 dark:border-blue-500
                             pl-4 py-1 italic text-slate-500 dark:text-slate-400 text-lg leading-relaxed
                             empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="onBlockKeydown(block, i, $event)"
                      @focus="onBlockFocus(block)"
                      @mouseup="onTextMouseUp"
                    />

                    <!-- UNORDERED LIST -->
                    <ul
                      v-else-if="block.type === 'ul'"
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      data-placeholder="Элемент списка..."
                      class="outline-none w-full list-disc list-inside text-slate-700 dark:text-slate-300 text-[15px] space-y-1 leading-7
                             empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="onBlockKeydown(block, i, $event)"
                      @focus="onBlockFocus(block)"
                      @mouseup="onTextMouseUp"
                    />

                    <!-- ORDERED LIST -->
                    <ol
                      v-else-if="block.type === 'ol'"
                      :ref="(el: any) => setBlockRef(block.id, el)"
                      contenteditable="true"
                      data-placeholder="Элемент списка..."
                      class="outline-none w-full list-decimal list-inside text-slate-700 dark:text-slate-300 text-[15px] space-y-1 leading-7
                             empty:before:content-[attr(data-placeholder)] empty:before:text-slate-300 dark:empty:before:text-slate-600"
                      @input="block.content = ($event.target as HTMLElement).innerHTML"
                      @keydown="onBlockKeydown(block, i, $event)"
                      @focus="onBlockFocus(block)"
                      @mouseup="onTextMouseUp"
                    />

                    <!-- DIVIDER -->
                    <div v-else-if="block.type === 'divider'" class="py-3">
                      <div class="flex items-center gap-3">
                        <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <div class="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                        <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>

                    <!-- CALLOUT -->
                    <div
                      v-else-if="block.type === 'callout'"
                      class="rounded-xl p-4 flex gap-3"
                      :class="calloutClass(block.attrs.calloutType)"
                    >
                      <div class="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center" :class="calloutIconBg(block.attrs.calloutType)">
                        <Icon :name="calloutIcon(block.attrs.calloutType)" class="h-3 w-3" :class="calloutIconClass(block.attrs.calloutType)" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div
                          :ref="(el: any) => setBlockRef(block.id, el)"
                          contenteditable="true"
                          data-placeholder="Текст заметки..."
                          class="outline-none w-full text-sm leading-relaxed
                                 empty:before:content-[attr(data-placeholder)] empty:before:opacity-40"
                          @input="block.content = ($event.target as HTMLElement).innerHTML"
                          @keydown="onBlockKeydown(block, i, $event)"
                          @focus="onBlockFocus(block)"
                          @mouseup="onTextMouseUp"
                        />
                        <!-- Type switcher -->
                        <div class="mt-2.5 flex gap-1">
                          <button
                            v-for="ct in ['info','warning','success']" :key="ct"
                            class="text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide transition-all"
                            :class="block.attrs.calloutType === ct
                              ? calloutActiveBtnClass(ct)
                              : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'"
                            @click.stop="block.attrs.calloutType = ct"
                          >{{ { info: 'Инфо', warning: 'Важно', success: 'Готово' }[ct] }}</button>
                        </div>
                      </div>
                    </div>

                    <!-- IMAGE -->
                    <div v-else-if="block.type === 'image'" class="py-1">
                      <div
                        v-if="!block.attrs.src"
                        class="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center
                               hover:border-blue-300 dark:hover:border-blue-700 transition-colors group/img-drop"
                      >
                        <div class="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-3 mb-3">
                          <Icon name="lucide:image-plus" class="h-7 w-7 text-slate-400 dark:text-slate-500" />
                        </div>
                        <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Добавьте изображение</p>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mb-4">Вставьте URL или загрузите файл</p>
                        <input
                          class="w-full max-w-xs mx-auto block px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700
                                 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none
                                 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-shadow"
                          placeholder="https://example.com/image.jpg"
                          @change="block.attrs.src = ($event.target as HTMLInputElement).value"
                        />
                      </div>
                      <div v-else class="relative group/img">
                        <img
                          :src="block.attrs.src"
                          :alt="block.attrs.alt || ''"
                          class="w-full rounded-xl object-cover shadow-sm"
                        />
                        <!-- Caption & alt -->
                        <div class="mt-3 space-y-1.5">
                          <input
                            :value="block.attrs.caption"
                            placeholder="Подпись к изображению..."
                            class="w-full text-sm text-center text-slate-500 dark:text-slate-400 bg-transparent outline-none
                                   border-b border-transparent focus:border-slate-300 dark:focus:border-slate-600 py-0.5 transition-colors"
                            @input="block.attrs.caption = ($event.target as HTMLInputElement).value"
                          />
                          <input
                            :value="block.attrs.alt"
                            placeholder="Alt текст для SEO..."
                            class="w-full text-xs text-center text-slate-400 dark:text-slate-500 bg-transparent outline-none
                                   border-b border-transparent focus:border-slate-200 dark:focus:border-slate-700 py-0.5 transition-colors"
                            @input="block.attrs.alt = ($event.target as HTMLInputElement).value"
                          />
                        </div>
                        <button
                          class="absolute top-2.5 right-2.5 opacity-0 group-hover/img:opacity-100 transition-opacity
                                 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm text-slate-600 dark:text-slate-300
                                 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1 text-xs font-medium shadow-sm"
                          @click.stop="block.attrs.src = ''"
                        >
                          Изменить
                        </button>
                      </div>
                    </div>

                    <!-- RAW HTML -->
                    <div v-else-if="block.type === 'html'" class="py-1">
                      <div class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div class="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                          <div class="inline-flex rounded bg-violet-100 dark:bg-violet-900/30 p-0.5">
                            <Icon name="lucide:code-2" class="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <span class="text-xs text-slate-500 dark:text-slate-400 font-mono font-semibold">HTML</span>
                        </div>
                        <textarea
                          :value="block.content"
                          rows="4"
                          class="w-full px-4 py-3 font-mono text-[13px] leading-relaxed text-slate-800 dark:text-slate-200
                                 bg-white dark:bg-slate-900 outline-none resize-y"
                          placeholder="<p>Вставьте HTML код...</p>"
                          @input="block.content = ($event.target as HTMLTextAreaElement).value"
                        />
                      </div>
                    </div>

                  </div><!-- /block content -->
                </div><!-- /block wrapper -->

                <!-- Add between blocks (hidden by default for intermediate blocks) -->
                <div v-if="i < blocks.length - 1" class="group/block-spacer -mx-3">
                  <PublicationEditorAddBetweenBlock :index="i + 1" @open="openPicker(i + 1)" />
                </div>

              </template>

              <!-- Add button after last block (always visible) -->
              <div v-if="blocks.length > 0" class="-mx-3">
                <PublicationEditorAddBetweenBlock :index="blocks.length" @open="openPicker(blocks.length)" />
              </div>

              <!-- Empty state -->
              <div v-if="blocks.length === 0" class="py-16 text-center">
                <div class="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-5 mb-4">
                  <Icon name="lucide:layout-template" class="h-10 w-10 text-slate-300 dark:text-slate-600" />
                </div>
                <p class="text-sm font-medium text-slate-400 dark:text-slate-500">Нажмите «+» чтобы добавить первый блок</p>
                <p class="text-xs text-slate-300 dark:text-slate-600 mt-1">Параграфы, заголовки, изображения и многое другое</p>
              </div>

            </div><!-- /blocks -->
          </div><!-- /document card -->
        </div>
      </main>

      <!-- ── SIDEBAR ───────────────────────────────────────────────────── -->
      <!-- Desktop: always visible on right -->
      <aside class="hidden md:flex flex-shrink-0 w-72 xl:w-[300px] border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col overflow-hidden">
        <div class="flex gap-1 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <button
            class="flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200"
            :class="sidebarTab === 'settings'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
            @click="sidebarTab = 'settings'"
          >{{ t('admin.editor.settings') }}</button>
          <button
            class="flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 relative overflow-hidden"
            :class="sidebarTab === 'seo'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
            @click="sidebarTab = 'seo'"
          >
            <!-- Progress bar background fill -->
            <div
              class="absolute inset-0 rounded-lg transition-all duration-300 opacity-20 dark:opacity-30"
              :class="seoScore >= 70 ? 'bg-green-500' : seoScore >= 40 ? 'bg-amber-400' : 'bg-red-500'"
              :style="{ width: seoScore + '%' }"
            />
            <!-- Text label (on top) -->
            <span class="relative z-10">SEO</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <PublicationEditorSettingsSidebar
            v-if="sidebarTab === 'settings'"
            :article="article"
            @update:article="onArticlePatch"
            @clear="clearAllConfirm"
          @add-block="openPicker(blocks.length)"
          />
          <PublicationEditorSeoSidebar
            v-else
            :article="article"
            :blocks="blocks"
            @update:article="onArticlePatch"
          />
        </div>
      </aside>

      <!-- Mobile: modal overlay -->
      <Teleport to="body">
        <div
          v-if="isMobileSidebarOpen"
          class="md:hidden fixed inset-0 z-40 bg-black/40 dark:bg-black/60 transition-opacity"
          @click="isMobileSidebarOpen = false"
        />
        <aside
          v-if="isMobileSidebarOpen"
          class="md:hidden fixed top-0 right-0 bottom-0 z-50 w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-xl transition-transform"
        >
          <div class="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
            <div class="flex gap-1 flex-1">
              <button
                class="flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200"
                :class="sidebarTab === 'settings'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                @click="sidebarTab = 'settings'"
              >{{ t('admin.editor.settings') }}</button>
              <button
                class="flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 relative overflow-hidden"
                :class="sidebarTab === 'seo'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                @click="sidebarTab = 'seo'"
              >
                <!-- Progress bar background fill -->
                <div
                  class="absolute inset-0 rounded-lg transition-all duration-300 opacity-20 dark:opacity-30"
                  :class="seoScore >= 70 ? 'bg-green-500' : seoScore >= 40 ? 'bg-amber-400' : 'bg-red-500'"
                  :style="{ width: seoScore + '%' }"
                />
                <!-- Text label (on top) -->
                <span class="relative z-10">SEO</span>
              </button>
            </div>
            <button
              class="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              @click="isMobileSidebarOpen = false"
            >
              <Icon name="lucide:x" class="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <PublicationEditorSettingsSidebar
              v-if="sidebarTab === 'settings'"
              :article="article"
              @update:article="onArticlePatch"
              @clear="clearAllConfirm"
            />
            <PublicationEditorSeoSidebar
              v-else
              :article="article"
              :blocks="blocks"
              @update:article="onArticlePatch"
            />
          </div>
        </aside>
      </Teleport>
    </div>

    <!-- Floating sidebar button (mobile only) -->
    <button
      v-if="!isMobileSidebarOpen"
      class="md:hidden fixed bottom-6 right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
      @click="isMobileSidebarOpen = true"
      title="Settings"
    >
      <Icon name="lucide:panel-right" class="h-6 w-6" />

        <!-- Floating add block button (mobile only) -->
        <button
          v-if="!isMobileSidebarOpen"
          class="md:hidden fixed bottom-6 right-24 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
          @click="openPicker(blocks.length)"
          title="Add block"
        >
          <Icon name="lucide:plus" class="h-6 w-6" />
        </button>
    </button>

    <PublicationEditorBlockPickerModal
      :open="picker.open"
      @update:open="picker.open = $event"
      @add="insertBlock(picker.atIndex, $event)"
    />

    <PublicationEditorFormatToolbar
      :format-bar="formatBar"
      @hide="hideFormatBar"
      @apply-format="applyFormat"
    />

    <!-- CUSTOM CONFIRM DIALOG -->
    <Teleport to="body">
      <div
        v-if="confirmDialog.open"
        class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
        @click.self="confirmDialog.open = false"
      >
        <div class="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
          <div class="p-5 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">{{ confirmDialog.title }}</h3>
            <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{{ confirmDialog.message }}</p>
          </div>

          <div class="p-4 flex items-center justify-end gap-2">
            <button
              class="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              @click="confirmDialog.open = false"
            >
              {{ confirmDialog.cancelLabel }}
            </button>
            <button
              class="px-3.5 py-2 rounded-lg text-white transition-colors"
              :class="confirmDialog.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'"
              @click="runConfirmAction"
              @keydown.enter="runConfirmAction"
            >
              {{ confirmDialog.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { useI18n } from '@/composables/useI18n'

definePageMeta({ layout: false, middleware: 'admin' })
const { t } = useI18n()


// ─── Types ───────────────────────────────────────────────────────────────
interface Block {
  id: string
  type: string
  content: string
  attrs: Record<string, any>
}

interface ArticleState {
  title: string
  slug: string
  status: 'draft' | 'published'
  category: string
  author: string
  publishedAt: string
  featuredImage: string
  tags: string[]
  metaTitle: string
  metaDescription: string
  focusKeyword: string
  ogImage: string
  robots: string
}

// ─── Article state ────────────────────────────────────────────────────────
const article = reactive<ArticleState>({
  title: '',
  slug: '',
  status: 'draft',
  category: '',
  author: '',
  publishedAt: new Date().toISOString().split('T')[0],
  featuredImage: '',
  tags: [],
  metaTitle: '',
  metaDescription: '',
  focusKeyword: '',
  ogImage: '',
  robots: 'index',
})

// ─── Blocks ───────────────────────────────────────────────────────────────
const blocks = ref<Block[]>([])
const activeBlockId = ref<string | null>(null)
const blockRefs = new Map<string, HTMLElement>()
const titleEl = ref<HTMLElement | null>(null)

let _idCounter = 0
function uid() { return `b${++_idCounter}_${Math.random().toString(36).slice(2, 7)}` }

function createBlock(type: string): Block {
  const defaults: Record<string, any> = {
    calloutType: 'info',
  }
  return {
    id: uid(),
    type,
    content: type === 'ul' ? '<li>Элемент</li>' : type === 'ol' ? '<li>Элемент</li>' : '',
    attrs: type === 'callout' ? { calloutType: 'info' } : {},
  }
}

function setBlockRef(id: string, el: HTMLElement | null) {
  if (el) blockRefs.set(id, el)
  else blockRefs.delete(id)
}

function focusBlock(id: string) {
  nextTick(() => {
    const el = blockRefs.get(id)
    if (el) {
      el.focus()
      // Move cursor to end
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(el)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  })
}

// ─── Block operations ─────────────────────────────────────────────────────
function insertBlock(index: number, type: string) {
  picker.open = false
  const block = createBlock(type)
  blocks.value.splice(index, 0, block)
  activeBlockId.value = block.id
  nextTick(() => {
    const el = blockRefs.get(block.id)
    if (el) {
      el.innerHTML = block.content
      el.focus()
    }
  })
}

function addBlock(index: number, type = 'paragraph') {
  insertBlock(index, type)
}

function duplicateBlock(index: number) {
  const src = blocks.value[index]
  const clone: Block = {
    id: uid(),
    type: src.type,
    content: src.content,
    attrs: { ...src.attrs },
  }
  blocks.value.splice(index + 1, 0, clone)
  nextTick(() => {
    const el = blockRefs.get(clone.id)
    if (el) el.innerHTML = clone.content
  })
}

function moveBlock(index: number, dir: number) {
  const target = index + dir
  if (target < 0 || target >= blocks.value.length) return
  const arr = blocks.value
  ;[arr[index], arr[target]] = [arr[target], arr[index]]
  blocks.value = [...arr]
}

// ─── Keyboard handling in blocks ─────────────────────────────────────────
function onBlockKeydown(block: Block, index: number, e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && block.type !== 'ul' && block.type !== 'ol') {
    e.preventDefault()
    const newBlock = createBlock('paragraph')
    blocks.value.splice(index + 1, 0, newBlock)
    activeBlockId.value = newBlock.id
    nextTick(() => {
      const el = blockRefs.get(newBlock.id)
      if (el) { el.innerHTML = ''; el.focus() }
    })
  }
  if (e.key === 'Backspace') {
    const el = blockRefs.get(block.id)
    if (el && (el.innerHTML === '' || el.innerHTML === '<br>') && blocks.value.length > 1) {
      e.preventDefault()
      deleteBlock(index)
      // Focus previous block
      const prevIndex = Math.max(0, index - 1)
      if (blocks.value[prevIndex]) {
        focusBlock(blocks.value[prevIndex].id)
      }
    }
  }
}

function onBlockFocus(block: Block) {
  activeBlockId.value = block.id
}

// ─── Drag & drop ─────────────────────────────────────────────────────────
const dragState = reactive({ index: -1, over: -1 })

function startDrag(index: number, e: DragEvent) {
  if (!e.dataTransfer) return
  dragState.index = index
  dragState.over = index
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/html', 'block')
  // Create invisible drag image for better UX
  const img = new Image()
  e.dataTransfer.setDragImage(img, 0, 0)
}

function onDragOver(index: number) {
  if (dragState.index === -1) return
  dragState.over = index
}

function onDrop(index: number) {
  const from = dragState.index
  if (from === -1 || from === index) {
    endDrag()
    return
  }
  
  const arr = [...blocks.value]
  const [moved] = arr.splice(from, 1)
  const targetIndex = from < index ? index - 1 : index
  arr.splice(targetIndex, 0, moved)
  blocks.value = arr
  activeBlockId.value = moved?.id ?? activeBlockId.value
  scheduleAutosave()
  endDrag()
}

function endDrag() {
  dragState.index = -1
  dragState.over = -1
}

// ─── Block picker ─────────────────────────────────────────────────────────
const picker = reactive({ open: false, atIndex: 0 })

function openPicker(index: number) {
  picker.atIndex = index
  picker.open = true
}

// ─── Text format toolbar ──────────────────────────────────────────────────
const formatBar = reactive({ visible: false, x: 0, y: 0 })
let savedRange: Range | null = null
const isSlugManuallyEdited = ref(false)

const SAVE_DEBOUNCE_MS = 500
let saveTimer: ReturnType<typeof setTimeout> | null = null
const isHydrating = ref(false)
const isDirty = ref(false)
const isSaving = ref(false)
const isSavingManually = ref(false)
const isMobileSidebarOpen = ref(false)

const confirmDialog = reactive({
  open: false,
  type: 'clear' as 'clear' | 'deleteBlock',
  title: '',
  message: '',
  confirmLabel: '',
  cancelLabel: '',
  variant: 'danger' as 'danger' | 'primary',
})

const pendingDeleteBlockIndex = ref<number | null>(null)

function openConfirmDialog(type: 'clear' | 'deleteBlock', blockIndex?: number) {
  pendingDeleteBlockIndex.value = null

  if (type === 'clear') {
    confirmDialog.type = 'clear'
    confirmDialog.title = 'Очистить весь контент?'
    confirmDialog.message = 'Это удалит всю статью из редактора. Действие нельзя отменить.'
    confirmDialog.confirmLabel = 'Очистить'
    confirmDialog.cancelLabel = 'Отмена'
    confirmDialog.variant = 'danger'
  } else {
    confirmDialog.type = 'deleteBlock'
    confirmDialog.title = 'Удалить блок?'
    confirmDialog.message = 'Это действие нельзя отменить.'
    confirmDialog.confirmLabel = 'Удалить'
    confirmDialog.cancelLabel = 'Отмена'
    confirmDialog.variant = 'danger'
    pendingDeleteBlockIndex.value = typeof blockIndex === 'number' ? blockIndex : null
  }
  confirmDialog.open = true
}

function runConfirmAction() {
  const type = confirmDialog.type
  confirmDialog.open = false

  if (type === 'clear') {
    performClearAll()
    return
  }

  if (type === 'deleteBlock') {
    const index = pendingDeleteBlockIndex.value
    pendingDeleteBlockIndex.value = null
    if (index === null || index < 0 || index >= blocks.value.length) return
    blocks.value.splice(index, 1)
    scheduleAutosave()
  }
}

function applyFormat(cmd: string, value?: string) {
  // Restore selection before applying
  if (savedRange) {
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(savedRange)
  }
  document.execCommand(cmd, false, value)
  hideFormatBar()
}

function onTextMouseUp() {
  nextTick(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hideFormatBar()
      return
    }
    savedRange = sel.getRangeAt(0).cloneRange()
    const rect = sel.getRangeAt(0).getBoundingClientRect()
    formatBar.x = rect.left + rect.width / 2
    formatBar.y = rect.top + window.scrollY
    formatBar.visible = true
  })
}

function hideFormatBar() {
  formatBar.visible = false
  savedRange = null
}


function onDocumentClick(e: MouseEvent) {
  const toolbar = document.querySelector('.publication-builder .fixed')
  if (toolbar && !toolbar.contains(e.target as Node)) {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) hideFormatBar()
  }
}

// ─── SEO helpers ──────────────────────────────────────────────────────────
const seoScore = computed(() => {
  let score = 0
  if (article.metaTitle) score += 15
  if (article.metaTitle.length >= 30 && article.metaTitle.length <= 60) score += 15
  if (article.metaDescription) score += 15
  if (article.metaDescription.length >= 120 && article.metaDescription.length <= 160) score += 15
  if (article.slug) score += 10
  if (article.focusKeyword) score += 10
  if (article.focusKeyword && article.metaTitle.toLowerCase().includes(article.focusKeyword.toLowerCase())) score += 10
  if (blocks.value.some(b => b.type === 'image' && b.attrs.alt)) score += 10
  return score
})

function syncSlug() {
  if (isSlugManuallyEdited.value) return
  const title = article.title.trim()
  if (!title) {
    article.slug = ''
    return
  }

  const normalized = title
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)

  article.slug = normalized.length <= 1 ? '' : normalized
}

function generateSlugFromTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)

  return normalized.length <= 1 ? '' : normalized
}

function onArticlePatch(patch: Partial<ArticleState>) {
  if (Object.prototype.hasOwnProperty.call(patch, 'slug')) {
    isSlugManuallyEdited.value = true
    const incoming = String(patch.slug || '')
      .toLowerCase()
      .replace(/[^a-zа-яё0-9-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80)
    Object.assign(article, { ...patch, slug: incoming })
    return
  }

  Object.assign(article, patch)
}

// ─── Block type label ─────────────────────────────────────────────────────
function blockTypeLabel(type: string) {
  const map: Record<string, string> = {
    paragraph: '¶', h2: 'H2', h3: 'H3', h4: 'H4', h5: 'H5',
    quote: '"', ul: 'UL', ol: 'OL', image: 'IMG',
    callout: 'ℹ', divider: '—', html: '</>',
  }
  return map[type] ?? type
}

// ─── Block style helpers ──────────────────────────────────────────────────
function headingClass(type: string) {
  return {
    h2: 'text-3xl font-bold text-slate-900 dark:text-white',
    h3: 'text-2xl font-bold text-slate-900 dark:text-white',
    h4: 'text-xl font-semibold text-slate-900 dark:text-white',
    h5: 'text-lg font-semibold text-slate-800 dark:text-slate-100',
  }[type] ?? 'text-2xl font-bold text-slate-900 dark:text-white'
}

function headingPlaceholder(type: string) {
  return { h2: 'Заголовок H2...', h3: 'Заголовок H3...', h4: 'Заголовок H4...', h5: 'Заголовок H5...' }[type] ?? 'Заголовок...'
}

function calloutClass(type: string) {
  return {
    info: 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900',
    warning: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900',
    success: 'bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900',
  }[type] ?? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900'
}

function calloutIcon(type: string) {
  return { info: 'lucide:info', warning: 'lucide:alert-triangle', success: 'lucide:check-circle-2' }[type] ?? 'lucide:info'
}

function calloutIconBg(type: string) {
  return {
    info: 'bg-blue-100 dark:bg-blue-900/50',
    warning: 'bg-amber-100 dark:bg-amber-900/50',
    success: 'bg-green-100 dark:bg-green-900/50',
  }[type] ?? 'bg-blue-100 dark:bg-blue-900/50'
}

function calloutIconClass(type: string) {
  return {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-green-600 dark:text-green-400',
  }[type] ?? 'text-blue-600 dark:text-blue-400'
}

function calloutActiveBtnClass(type: string) {
  return {
    info: 'bg-blue-100 dark:bg-blue-900/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300',
    warning: 'bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300',
    success: 'bg-green-100 dark:bg-green-900/50 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300',
  }[type] ?? 'bg-blue-100 border-blue-300 text-blue-700'
}

// ─── Sidebar tab ──────────────────────────────────────────────────────────
const sidebarTab = ref<'settings' | 'seo'>('settings')

// ─── Actions ─────────────────────────────────────────────────────────────
function getPayload(syncDom = true) {
  // Sync HTML content from live DOM before saving
  if (syncDom) {
    for (const block of blocks.value) {
      const el = blockRefs.get(block.id)
      if (el && block.type !== 'divider' && block.type !== 'image' && block.type !== 'html') {
        block.content = el.innerHTML
      }
    }
  }
  
  // Trim whitespace from all text fields
  const trimmedArticle = { ...article }
  trimmedArticle.title = (trimmedArticle.title || '').trim()
  trimmedArticle.slug = (trimmedArticle.slug || '').trim()
  trimmedArticle.author = (trimmedArticle.author || '').trim()
  trimmedArticle.metaTitle = (trimmedArticle.metaTitle || '').trim()
  trimmedArticle.metaDescription = (trimmedArticle.metaDescription || '').trim()
  trimmedArticle.focusKeyword = (trimmedArticle.focusKeyword || '').trim()
  
  // Trim block content (text blocks)
  const trimmedBlocks = blocks.value.map(block => ({
    ...block,
    content: ['divider', 'image', 'html'].includes(block.type)
      ? block.content
      : (block.content || '').trim()
  }))
  
  return { article: trimmedArticle, blocks: trimmedBlocks }
}

function hydrateEditorDomFromState() {
  nextTick(() => {
    if (titleEl.value) {
      titleEl.value.innerText = article.title || ''
    }

    for (const block of blocks.value) {
      const el = blockRefs.get(block.id)
      if (!el) continue
      if (block.type === 'divider' || block.type === 'image' || block.type === 'html') continue
      if (el.innerHTML !== block.content) {
        el.innerHTML = block.content || ''
      }
    }
  })
}

function saveDraft() {
  if (!isDirty.value) return
  article.status = 'draft'
  isSaving.value = true
  const payload = getPayload(true)
  // Prevent autosave from being triggered by state updates
  isSavingManually.value = true
  // Apply trimmed values back to state
  Object.assign(article, payload.article)
  blocks.value = payload.blocks
  console.log('[save draft]', payload)
  // Save to localStorage
  saveToLocalStorage(false)
  isDirty.value = false
  // Allow autosave again after a tick
  nextTick(() => {
    isSavingManually.value = false
  })
  // Simulate API delay for animation
  setTimeout(() => {
    isSaving.value = false
  }, 600)
  // TODO: call API
}

function publish() {
  article.status = 'published'
  const payload = getPayload(true)
  // Apply trimmed values back to state
  Object.assign(article, payload.article)
  blocks.value = payload.blocks
  console.log('[publish]', payload)
  saveToLocalStorage(false)
  isDirty.value = false
  // TODO: call API
}

function closeAll() {
  activeBlockId.value = null
  hideFormatBar()
}

// ─── LocalStorage ─────────────────────────────────────────────────────────
const STORAGE_KEY = 'publication_editor_draft'

function saveToLocalStorage(syncDom = false) {
  const data = getPayload(syncDom)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.warn('Failed to save to localStorage', e)
  }
}

function scheduleAutosave() {
  if (isHydrating.value) return
  if (isSavingManually.value) return
  isDirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    isSaving.value = true
    const payload = getPayload(true)
    // Apply trimmed values back to state
    Object.assign(article, payload.article)
    blocks.value = payload.blocks
    saveToLocalStorage(false)
    saveTimer = null
    setTimeout(() => {
      isSaving.value = false
    }, 400)
  }, SAVE_DEBOUNCE_MS)
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false
    const data = JSON.parse(saved)
    if (data.article && data.blocks) {
      const loadedTitle = String(data.article.title || '').trim()
      const loadedSlug = String(data.article.slug || '').trim()
      const generatedFromTitle = generateSlugFromTitle(loadedTitle)

      if (!loadedTitle || loadedSlug.length <= 1) {
        data.article.slug = ''
        isSlugManuallyEdited.value = false
      } else if (!loadedSlug || loadedSlug === generatedFromTitle) {
        isSlugManuallyEdited.value = false
      } else {
        isSlugManuallyEdited.value = true
      }

      Object.assign(article, data.article)
      blocks.value = data.blocks
      return true
    }
  } catch (e) {
    console.warn('Failed to load from localStorage', e)
  }
  return false
}

function deleteBlock(i: number) {
  openConfirmDialog('deleteBlock', i)
}

function clearAllConfirm() {
  openConfirmDialog('clear')
}

function performClearAll() {
  blocks.value = [createBlock('paragraph')]
  article.title = ''
  article.slug = ''
  article.metaTitle = ''
  article.metaDescription = ''
  article.focusKeyword = ''
  article.ogImage = ''
  article.tags = []
  article.category = 'news'
  article.status = 'draft'
  isSlugManuallyEdited.value = false
  localStorage.removeItem(STORAGE_KEY)
  isDirty.value = false
  nextTick(() => titleEl.value?.focus())
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    saveDraft()
  }
  if (e.key === 'Escape') {
    picker.open = false
    hideFormatBar()
    confirmDialog.open = false
  }

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
    e.preventDefault()
    window.location.reload()
  }

  if (e.key === 'F5') {
    e.preventDefault()
    window.location.reload()
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocumentClick)
  // Load from localStorage if available, otherwise start with one empty paragraph
  isHydrating.value = true
  if (!loadFromLocalStorage()) {
    const first = createBlock('paragraph')
    blocks.value.push(first)
  }

  hydrateEditorDomFromState()

  nextTick(() => {
    isHydrating.value = false
    watch(blocks, scheduleAutosave, { deep: true })
    watch(article, scheduleAutosave, { deep: true })
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocumentClick)
  if (saveTimer) clearTimeout(saveTimer)
})
</script>

<style scoped>
/* Placeholder for empty contenteditable */
[contenteditable]:empty:before {
  pointer-events: none;
  user-select: none;
}

:deep(a) {
  color: rgb(37 99 235);
  text-decoration: underline;
  text-underline-offset: 2px;
}

:deep(strong), :deep(b) {
  font-weight: 700;
}

/* Unified soft focus for all form controls inside editor */
:deep(input),
:deep(textarea),
:deep(select) {
  outline: none !important;
}

:deep(input:focus),
:deep(textarea:focus),
:deep(select:focus),
:deep(input:focus-visible),
:deep(textarea:focus-visible),
:deep(select:focus-visible) {
  outline: none !important;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35) !important;
}

:global(.dark) :deep(input:focus),
:global(.dark) :deep(textarea:focus),
:global(.dark) :deep(select:focus),
:global(.dark) :deep(input:focus-visible),
:global(.dark) :deep(textarea:focus-visible),
:global(.dark) :deep(select:focus-visible) {
  box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.45) !important;
}

/* Smooth drag transition */
.group[draggable="true"] {
  cursor: default;
}
</style>
