import { render } from 'preact';
import { App } from './ui/App';
import './index.css';

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}
