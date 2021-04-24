import React from "react";
import { isValidElementType } from "react-is";
import PropTypes from "prop-types";
import invariant from "tiny-invariant";
import warning from "tiny-warning";

import RouterContext from "./RouterContext.js";
import matchPath from "./matchPath.js";

function isEmptyChildren(children) {
  return React.Children.count(children) === 0;
}

function evalChildrenDev(children, props, path) {
  const value = children(props);

  warning(
    value !== undefined,
    "You returned `undefined` from the `children` function of " +
      `<Route${path ? ` path="${path}"` : ""}>, but you ` +
      "should have returned a React element or `null`"
  );

  return value || null;
}

/**
 * The public API for matching a single path and rendering.
 */
class Route extends React.Component {
  render() {
    return (
      /**
       * 通过使用 React Context 获取最近的 Router context 内容
       * Consumer: https://zh-hans.reactjs.org/docs/context.html#contextconsumer
       */
      <RouterContext.Consumer>
        {context => {
          /**
           * invariant 方法是用来判断 Route 组件是不是被 Router 组件包裹
           * 因为 Route 组件的正确使用发放是放在 Router 组件里面的
           */
          invariant(context, "You should not use <Route> outside a <Router>");

          /**
           * location 是当前的路由状态
           * Route 组件主要用它来判断 pathname 是否匹配当前页面
           */
          const location = this.props.location || context.location;

          /**
           * 当 Route 组件获取到路由状态时，就会进行匹配判断，当 match 为 true 时，
           * 渲染对应页面
           *
           * 1. 如果外层有 Switch 组件且已经帮 Route 判断正确匹配，那就渲染页面
           *    注：Switch 内的 match 方法和 Route 的是一致的
           * 2. 如果
           */
          const match = this.props.computedMatch
            ? this.props.computedMatch // <Switch> already computed the match for us
            : this.props.path
            ? matchPath(location.pathname, this.props)
            : context.match;

          const props = { ...context, location, match };

          let { children, component, render } = this.props;

          // Preact uses an empty array as children by
          // default, so use null if that's the case.
          if (Array.isArray(children) && isEmptyChildren(children)) {
            children = null;
          }

          return (
            <RouterContext.Provider value={props}>
              {props.match
                ? children
                  ? typeof children === "function"
                    ? __DEV__
                      ? evalChildrenDev(children, props, this.props.path)
                      : children(props)
                    : children
                  : component
                  ? React.createElement(component, props)
                  : render
                  ? render(props)
                  : null
                : typeof children === "function"
                ? __DEV__
                  ? evalChildrenDev(children, props, this.props.path)
                  : children(props)
                : null}
            </RouterContext.Provider>
          );
        }}
      </RouterContext.Consumer>
    );
  }
}

if (__DEV__) {
  Route.propTypes = {
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    component: (props, propName) => {
      if (props[propName] && !isValidElementType(props[propName])) {
        return new Error(
          `Invalid prop 'component' supplied to 'Route': the prop is not a valid React component`
        );
      }
    },
    exact: PropTypes.bool,
    location: PropTypes.object,
    path: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.arrayOf(PropTypes.string)
    ]),
    render: PropTypes.func,
    sensitive: PropTypes.bool,
    strict: PropTypes.bool
  };

  Route.prototype.componentDidMount = function() {
    warning(
      !(
        this.props.children &&
        !isEmptyChildren(this.props.children) &&
        this.props.component
      ),
      "You should not use <Route component> and <Route children> in the same route; <Route component> will be ignored"
    );

    warning(
      !(
        this.props.children &&
        !isEmptyChildren(this.props.children) &&
        this.props.render
      ),
      "You should not use <Route render> and <Route children> in the same route; <Route render> will be ignored"
    );

    warning(
      !(this.props.component && this.props.render),
      "You should not use <Route component> and <Route render> in the same route; <Route render> will be ignored"
    );
  };

  Route.prototype.componentDidUpdate = function(prevProps) {
    warning(
      !(this.props.location && !prevProps.location),
      '<Route> elements should not change from uncontrolled to controlled (or vice versa). You initially used no "location" prop and then provided one on a subsequent render.'
    );

    warning(
      !(!this.props.location && prevProps.location),
      '<Route> elements should not change from controlled to uncontrolled (or vice versa). You provided a "location" prop initially but omitted it on a subsequent render.'
    );
  };
}

export default Route;
