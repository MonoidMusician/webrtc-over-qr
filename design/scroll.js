function makeScrollManagerFor(chat_content, chat_spacer) {
  var chat_scrolling = 0;

  var manager = {
    async adding(addContent, see='bottom') {
      var spacer = chat_spacer.getBoundingClientRect().height;
      chat_spacer.style.height = `${spacer}px`;

      var added = addContent();

      var visibleHeight = chat_content.getBoundingClientRect().height;
      var target = chat_content.scrollHeight - visibleHeight; // max scroll
      if (see === 'top') {
        if (added instanceof Node) {
          added = [added];
        }
        for (let node of added) {
          var top = node.getBoundingClientRect().top;
          if (top < target) target = top;
        }
      }
      var instantTarget = Math.max(chat_content.scrollTop, target - visibleHeight);

      await manager.scrollTo(instantTarget, target);
      chat_spacer.style.removeProperty('height');
    },
    scrollTo(instantTarget, target) {
      if (chat_content.scrollTop < instantTarget && instantTarget < target-1) {
        chat_content.scrollTo({
          top: (instantTarget + target)/2,
          behavior: 'instant',
        });
      }
      chat_content.scrollTo({
        top: target,
        behavior: useAnimations() ? 'smooth' : 'instant',
      });
      return new Promise(resolve => {
        requestAnimationFrame(manager.monitorScroll(target, resolve));
      });
    },
    monitorScroll(target, onscrollend) {
      var scroll_id = (++chat_scrolling);
      // var last_scroll = chat_content.scrollTop;
      var started = performance.now();
      var listener = () => {
        if (scroll_id !== chat_scrolling) return;
        var this_scroll = chat_content.scrollTop;
        if ((this_scroll >= target - 2) || (performance.now() >= started+1000)) {
          onscrollend();
          chat_scrolling = 0;
          return;
        } else {
          // last_scroll = this_scroll;
          requestAnimationFrame(listener);
        }
      };
      return listener;
    },
    atBottom() {
      var visibleHeight = chat_content.getBoundingClientRect().height;
      return chat_content.scrollTop >= chat_content.scrollHeight - visibleHeight - 2;
    },
  };
  manager.adding.see_bottom = (addContent) => manager.adding(addContent, 'bottom');
  manager.adding.see_top = (addContent) => manager.adding(addContent, 'top');
  return manager;
}
