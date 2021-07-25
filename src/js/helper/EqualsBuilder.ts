import { Helper } from './Helper';

/**
 * <pre>
 * public equals(obj: object): boolean {
 *   if (obj == null) { return false; }
 *   if (obj == this) { return true; }
 *   if (obj.getClass() != getClass()) {
 *     return false;
 *   }
 *   MyClass rhs = (MyClass) obj;
 *   return new EqualsBuilder()
 *                 .appendSuper(super.equals(obj))
 *                 .append(field1, rhs.field1)
 *                 .append(field2, rhs.field2)
 *                 .append(field3, rhs.field3)
 *                 .isEquals();
 *  }
 * </pre>
 */
export class EqualsBuilder {
	private isEquals: boolean;

	/**
	 * <p>Adds the result of {@code super.equals()} to this builder.</p>
	 * @param superEquals  the result of calling {@code super.equals()}
	 * @return EqualsBuilder - used to chain calls.
	 */
	appendSuper(superEquals: boolean): this {
		this.isEquals = !this.isEquals ? false : superEquals;
		return this;
	}

	/**
	 * <p>Test if two {@code Object}s are equal using either
	 * #{@link #reflectionAppend(Object, Object)}, if object are non
	 * primitives (or wrapper of primitives) or if field {@code testRecursive}
	 * is set to {@code false}. Otherwise, using their
	 * {@code equals} method.</p>
	 *
	 * @param lhs  the left hand object
	 * @param rhs  the right hand object
	 * @return EqualsBuilder - used to chain calls.
	 */
	append<T>(lhs: T, rhs: T): this {
		if (!this.isEquals) return this;
		//
		// isEqual
		else if (lhs === rhs) {
			this.isEquals = true;
			return this;
		}

		// is null
		else if (Helper.isNull(lhs) || Helper.isNull(rhs)) {
			this.isEquals = lhs === rhs;
			return this;
		}

		// isPrimitive
		else if (Helper.isPrimitive(lhs) || Helper.isPrimitive(rhs)) {
			this.isEquals = lhs === rhs;
			return this;
		}

		// isConstructor
		else if (lhs.constructor !== rhs.constructor) {
			this.isEquals = false;
			return this;
		}

		// isArray
		else if (Array.isArray(lhs) && Array.isArray(rhs)) {
			// isLength
			if (lhs.length !== rhs.length) {
				this.isEquals = false;
				return this;
			}

			// filter
			else {
				this.isEquals = lhs.some((l) => rhs.includes(l));
				return this;
			}
		}
	}

	// return
	isEqual(): boolean {
		return this.isEquals;
	}
}
