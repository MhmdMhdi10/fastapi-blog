import config from './config';
import jwtDecode from 'jwt-decode';
import * as moment from 'moment';

const axios = require('axios');


class FastAPIClient {
  constructor(overrides) {
    this.config = {
      ...config,
      ...overrides,
    };
    this.authToken = config.authToken;

    this.login = this.login.bind(this);
    this.apiClient = this.getApiClient(this.config);
    this.isSperUser = false
  }

  /* ----- Authentication & User Operations ----- */

  /* Authenticate the user with the backend services.
	 * The same JWT should be valid for both the api and cms */
  login(username, password) {
    delete this.apiClient.defaults.headers['Authorization'];

    // HACK: This is a hack for scenario where there is no login form
    const form_data = new FormData();
    const grant_type = 'password';
    const item = {grant_type, username, password};
    for (const key in item) {
      form_data.append(key, item[key]);
    }

    return this.apiClient
        .post('/auth/login', form_data)
        .then((resp) => {
          
          localStorage.setItem('token', JSON.stringify(resp.data));
          return this.fetchUser();
        });
  }

  fetchUser() {
    return this.apiClient.get('/auth/me').then(({data}) => {
      const userData = data;

      if (userData['is_superuser'] == true) {
        this.isSperUser = true;
      }
      localStorage.setItem('user', userData);
      return data;
    });
  }

  register(email, password, fullName) {
    const registerData = {
      email,
      password,
      full_name: fullName,
      is_active: true,
    };

    return this.apiClient.post('/auth/signup', registerData).then(
        (resp) => {
          return resp.data;
        });
  }

  // Logging out is just deleting the jwt.
  logout() {
    // Add here any other data that needs to be deleted from local storage
    // on logout
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  /* ----- Client Configuration ----- */

  /* Create Axios client instance pointing at the REST api backend */
  getApiClient(config) {
    const initialConfig = {
      baseURL: `${config.apiBasePath}`,
    };
    const client = axios.create(initialConfig);
    client.interceptors.request.use(localStorageTokenInterceptor);
    return client;
  }

  getPost(recipeId) {
    return this.apiClient.get(`/posts/${recipeId}`);
  }

  getPosts(keyword, limit) {
    return this.apiClient.get(`/posts?keyword=${keyword}&limit=${limit}`).then(({data}) => {
      return data;
    });
  }

  getUserPosts() {
    return this.apiClient.get('/posts').then(({data}) => {
      return data;
    });
  }

  createRecipe(label, url, source, submitter_id) {
    const recipeData = {
      label,
      url,
      source,
      submitter_id: submitter_id,
    };
    return this.apiClient.post(`/recipes/`, recipeData);
  }

  deletePost(PostId) {
    return this.apiClient.delete(`/posts/${PostId}`);
  }
};


// every request is intercepted and has auth header injected.
function localStorageTokenInterceptor(config) {
  const headers = {};
  const tokenString = localStorage.getItem('token');

  if (tokenString) {
    const token = JSON.parse(tokenString);
    
    const decodedAccessToken = jwtDecode(token.access_token);
    const isAccessTokenValid =
			moment.unix(decodedAccessToken.exp).toDate() > new Date();
    if (isAccessTokenValid) {
      headers['Authorization'] = `Bearer ${token.access_token}`;
    } else {
      alert('Your login session has expired');
    }
  }
  config['headers'] = headers;
  return config;
}

// const client = new FastAPIClient(config);

// const data = client.deletePost().then((response)=>console.log(response));
// console.log(data)

export default FastAPIClient;
