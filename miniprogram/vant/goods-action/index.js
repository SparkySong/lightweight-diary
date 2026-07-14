const { VantComponent } = require('../common/component');
const { useChildren } = require('../common/relation');
VantComponent({
    relation: useChildren('goods-action-button', function () {
        this.children.forEach((item) => {
            item.updateStyle();
        });
    }),
    props: {
        safeAreaInsetBottom: {
            type: Boolean,
            value: true,
        },
    },
});
