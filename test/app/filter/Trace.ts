import tracer from '@rockerjs/tracer';
import { Filter, AbstractFilter } from '../../../index';

@Filter
export class Trace extends AbstractFilter {
    init(args: string[]) {
        console.log('trace filter init', args);
    }

    async doFilter(context, next) {
        await tracer()(context, next);
    }

    destroy() {
        console.log('trace filter destroy')
    }
}