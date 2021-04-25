import pathToRegexp from "path-to-regexp";

const cache = {};
const cacheLimit = 10000;
let cacheCount = 0;

/**
 * 这里通过 [path-to-regexp](https://github.com/pillarjs/path-to-regexp) 库，将 path 转为正则判断
 * path-to-regexp ：Turn a path string such as `/user/:name` into a regular expression
 *
 * 简单理解就是，我们传给 Route 组件的 path, exact, strict... 等等 path 判断，都会交给它来处理，
 * 它处理后会返回一个正则给我们，我们用这个正则表达式来判断当前的 location.pathname 是否符合条件
 *
 *   简单看一下 pathToRegExp 的返回:
 *
 *   const keys = [];
 *   const regexp = pathToRegexp("/foo/:bar", keys);
 *   // regexp = /^\/foo(?:\/([^\/#\?]+?))[\/#\?]?$/i
 *   // keys = [{ name: 'bar', prefix: '/', suffix: '', pattern: '[^\\/#\\?]+?', modifier: '' }]
 *
 */
function compilePath(path, options) {
  /**
   * matchPath 方法的调用频率是非常高的
   * 每切换一次 location.pathname，所有 Route 组件都要重新做一遍校验
   *
   * 所以 React Router 在这里根据 path, options 做了一个缓存：当入参不变时，直接使用缓存，提高性能
   */
  const cacheKey = `${options.end}${options.strict}${options.sensitive}`;
  const pathCache = cache[cacheKey] || (cache[cacheKey] = {});

  if (pathCache[path]) return pathCache[path];

  const keys = [];
  /**
   * 这里就是前面说的，通过 pathToRegexp 返回正则
   */
  const regexp = pathToRegexp(path, keys, options);
  const result = { regexp, keys };

  if (cacheCount < cacheLimit) {
    pathCache[path] = result;
    cacheCount++;
  }

  return result;
}

/**
 * Public API for matching a URL pathname to a path.
 */
function matchPath(pathname, options = {}) {
  if (typeof options === "string" || Array.isArray(options)) {
    options = { path: options };
  }

  /**
   * 当我们不设置 exact, strict, sensitive 时，默认都为 false
   *
   * exact:
   *    When true, will only match if the path matches the location.pathname exactly.
   *    只有当 path === location.pathname 时，才渲染页面
   *
   * strict:
   *    严格匹配结尾斜线
   *    path      location.pathname  matches?
   *    /one/	    /one	             no
   *
   * sensitive:
   *    严格匹配大小写
   *    path      location.pathname  matches?
   *    /One      /one	             no
   */
  const { path, exact = false, strict = false, sensitive = false } = options;

  /**
   * commit message:
   * add support for an array of paths in <Route> and matchPath (#5889)
   *
   * 通过翻阅 commit 记录可以得知，这里为了兼容 Array 类型的 path，所以用了 concat、reduce
   * 只要其中一个 path 匹配，就算匹配成功
   */
  const paths = [].concat(path);

  return paths.reduce((matched, path) => {
    /**
     * 处理 path 为空的情况
     */
    if (!path && path !== "") return null;

    /**
     * 当 path 为数组时，只要其中一个 path 匹配，就算匹配成功
     */
    if (matched) return matched;

    /**
     *
     * 这里通过 [path-to-regexp](https://github.com/pillarjs/path-to-regexp) 库，将 path 转为正则判断
     * 简介：Turn a path string such as `/user/:name` into a regular expression
     *
     * 简单理解就是，我们传给 Route 组件的 path, exact, strict... 等等，都会交给它来处理，
     * 它处理后会返回:
     * 1. 一个正则，我们用这个正则表达式来判断当前的 location.pathname 是否符合条件
     * 2. keys：当我们传递 '/foo/:bar' 这种 path 给 React Router 的时候，它就会帮我们把 :bar 进行解析
     *          :bar -> { name: 'bar', prefix: '/', suffix: '', pattern: '[^\\/#\\?]+?', modifier: '' }
     * React Router 会通过返回的 regexp 通过调用 regexp.exec(pathname) 来获取到 :bar 对应的实际 value
     *
     */
    const { regexp, keys } = compilePath(path, {
      end: exact,
      strict,
      sensitive
    });

    /**
     * 这里使用 path-to-regexp 处理过的正则表达式来判断当前的 location.pathname 是否符合条件
     */
    const match = regexp.exec(pathname);

    /**
     * 如果不符合条件，则匹配失败
     */
    if (!match) return null;

    const [url, ...values] = match;

    /**
     * 当我们设置 exact 为 true 时，ReactRouter 的定义是完全相等，也就是 '==='
     *
     * 但是 pathToExact 没有 exact 选项
     *   例如我们只传 { exact: true, path: '/a/b/c' } 时
     *   pathToExact 返回的 regexp 匹配 regexp.exec('/A/B/C') 为 true
     *   example: https://regexr.com/5rhrq
     * 所以这时候就需要 React Router 自己做一下判断
     */
    const isExact = pathname === url;

    if (exact && !isExact) return null;

    return {
      path, // the path used to match
      url: path === "/" && url === "" ? "/" : url, // the matched portion of the URL
      isExact, // whether or not we matched exactly

      /**
       * 当 path 设置为 /foo/:bar 格式，实际 pathname 为 /foo/abc 时
       * 这里就会解析为： { bar: abc }
       *
       * 当我们调用 useParams 的时候，获取的值就是这个~
       */
      params: keys.reduce((memo, key, index) => {
        memo[key.name] = values[index];
        return memo;
      }, {})
    };
  }, null);
}

export default matchPath;
