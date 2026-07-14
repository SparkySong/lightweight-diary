const { VantComponent } = require('../common/component');
const { transition } = require('../mixins/transition');
VantComponent({
    classes: [
        'enter-class',
        'enter-active-class',
        'enter-to-class',
        'leave-class',
        'leave-active-class',
        'leave-to-class',
    ],
    mixins: [transition(true)],
});
