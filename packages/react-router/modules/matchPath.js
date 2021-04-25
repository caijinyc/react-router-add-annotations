import pathToRegexp from "path-to-regexp";

const cache = {};
const cacheLimit = 10000;
let cacheCount = 0;

function compilePath(path, options) {
  const cacheKey = `${options.end}${options.strict}${options.sensitive}`;
  const pathCache = cache[cacheKey] || (cache[cacheKey] = {});

  if (pathCache[path]) return pathCache[path];

  const keys = [];
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
     * 这里通过 [path-to-regexp](https://github.com/pillarjs/path-to-regexp) 库，将 path 转为正则判断
     * 简介：Turn a path string such as `/user/:name` into a regular expression
     *
     * 简单理解就是，我们传给 Route 组件的 path, exact, strict... 等等 path 判断，都会交给它来处理，
     * 它处理后会返回一个正则给我们，我们用这个正则表达式来判断当前的 location.pathname 是否符合条件
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
    const isExact = pathname === url;

    if (exact && !isExact) return null;

    return {
      path, // the path used to match
      url: path === "/" && url === "" ? "/" : url, // the matched portion of the URL
      isExact, // whether or not we matched exactly
      params: keys.reduce((memo, key, index) => {
        memo[key.name] = values[index];
        return memo;
      }, {})
    };
  }, null);
}

export default matchPath;
