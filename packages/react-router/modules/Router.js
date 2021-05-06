import React from "react";
import PropTypes from "prop-types";
import warning from "tiny-warning";

import HistoryContext from "./HistoryContext.js";
import RouterContext from "./RouterContext.js";

/**
 * The public API for putting history on context.
 *
 * Router 组件的功能：监听路由状态，将最新的路由信息传递给所有子组件
 */
class Router extends React.Component {
  static computeRootMatch(pathname) {
    return { path: "/", url: "/", params: {}, isExact: pathname === "/" };
  }

  constructor(props) {
    super(props);

    this.state = {
      location: props.history.location
    };

    // This is a bit of a hack. We have to start listening for location
    // changes here in the constructor in case there are any <Redirect>s
    // on the initial render. If there are, they will replace/push when
    // they mount and since cDM fires in children before parents, we may
    // get a new location before the <Router> is mounted.
    /**
     * 这里是用来兼容当组件还没有被渲染时，history.location 已经被修改的情况，
     * 因为在组件 didMount 之前，调用 setState 是不会生效的
     */
    this._isMounted = false;
    this._pendingLocation = null;

    if (!props.staticContext) {
      /**
       * ****这里非常重要****
       * Router 组件在初始化的时候会调用 history.listen 来监听页面路由的变化
       * 当路由发生变化时，更新 this.state.location
       * Router 组件通过 Context，将最新的 history.location 传递给所有组件，例如 Route, Redirect, Switch ...
       * 这些组件内部通过判断当前 history.location 和 props.path 等等的值，来确认是否渲染页面
       */
      this.unlisten = props.history.listen(location => {
        if (this._isMounted) {
          this.setState({ location });
        } else {
          // 如果组件还没有完成渲染，那就先把修改后的 location 存起来
          this._pendingLocation = location;
        }
      });
    }
  }

  componentDidMount() {
    this._isMounted = true;

    /**
     * Router 渲染完成后，如果发现 location 在渲染过程中已经发生变更，
     * 就需要把 location 更新一下
     */
    if (this._pendingLocation) {
      this.setState({ location: this._pendingLocation });
    }
  }

  componentWillUnmount() {
    if (this.unlisten) {
      this.unlisten();
      this._isMounted = false;
      this._pendingLocation = null;
    }
  }

  render() {
    /**
     * 通过 Context 将 history, location ... 传递给其他组件
     * 这些除了给 React-Router 的 Route, Switch, Redirect 使用外，
     *     在我们将业务组件传入 Route 时，可以直接通过 props 获取到。
     *     如果我们的组件被 Router 包裹的话，那么也可以直接通过 useLocation, useHistory 来获取到这些数据
     */
    return (
      <RouterContext.Provider
        value={{
          history: this.props.history,
          location: this.state.location,
          match: Router.computeRootMatch(this.state.location.pathname),
          staticContext: this.props.staticContext
        }}
      >
        <HistoryContext.Provider
          children={this.props.children || null}
          value={this.props.history}
        />
      </RouterContext.Provider>
    );
  }
}

if (__DEV__) {
  Router.propTypes = {
    children: PropTypes.node,
    history: PropTypes.object.isRequired,
    staticContext: PropTypes.object
  };

  Router.prototype.componentDidUpdate = function(prevProps) {
    warning(
      prevProps.history === this.props.history,
      "You cannot change <Router history>"
    );
  };
}

export default Router;
