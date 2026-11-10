<template>
<div class="main-layout">
  <AppSidebar :collapsed="collapsed" @toggle="toggleCollapse"></AppSidebar>
  <div class="main-body">
    <AppHeader :collapsed="collapsed" @toggle="toggleCollapse"></AppHeader>
    <main class="main-content">
      <RouterView></RouterView>
    </main>
  </div>
</div>
</template>
<script lang="ts" setup>
import { } from '@/vtj-compat';
import { ref } from 'vue';
import { RouterView } from 'vue-router';
import AppSidebar from '@/components/AppSidebar.vue';
import AppHeader from '@/components/AppHeader.vue';

const collapsed = ref(false);

const toggleCollapse = () => {
  collapsed.value = !collapsed.value;
}
</script>
<style lang="css" scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-page);
}
.main-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  transition: all var(--dur) var(--ease);
}
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
}
</style>
